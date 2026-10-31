"""Test di cancellazione e modifica delle transazioni importate e manuali."""

from fastapi.testclient import TestClient

import backend.db as db
from backend.app import app
from backend.services.imports import record_import


def _insert_imported(rows):
    """rows: (hash_id, date, description, amount, source)."""
    with db.db_cursor(commit=True) as cursor:
        for hash_id, date, description, amount, source in rows:
            db.execute(
                cursor,
                "INSERT INTO transactions "
                "(date, description, amount, source, macro_category, micro_category, hash_id) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (date, description, amount, source, 'Spese Fisse', 'Altro', hash_id),
            )


def _insert_manual(date, description, amount):
    with db.db_cursor(commit=True) as cursor:
        return db.insert_returning_id(
            cursor,
            "INSERT INTO manual_records "
            "(date, description, amount, macro_category, micro_category) "
            "VALUES (%s, %s, %s, %s, %s)",
            (date, description, amount, 'Entrate', 'Entrate_Lavoro'),
        )


def _count(sql, params=None):
    with db.db_cursor() as cursor:
        return db.execute(cursor, sql, params).fetchone()['cnt']


def test_import_batch_deletes_only_its_rows(temp_db):
    _insert_imported([
        ('imp_a', '2099-01-10', 'PRIMO', -10, 'Fineco'),
        ('imp_b', '2099-01-11', 'SECONDO', -20, 'Fineco'),
        ('imp_c', '2099-01-12', 'TERZO', -30, 'Revolut'),
    ])
    _insert_manual('2099-01-13', 'MANUALE', 500)
    batch_id = record_import('estratto.xlsx', 'Fineco', ['imp_a', 'imp_b', 'imp_b'])

    with TestClient(app) as client:
        imports = client.get('/api/imports').json()['imports']
        assert any(item['id'] == batch_id for item in imports)
        entry = next(item for item in imports if item['id'] == batch_id)
        assert entry['filename'] == 'estratto.xlsx'
        assert entry['records_added'] == 2

        result = client.delete(f'/api/imports/{batch_id}')
        assert result.status_code == 200
        assert result.json()['deleted_transactions'] == 2

        # Il lotto sparisce, la riga Revolut e quella manuale restano.
        assert all(item['id'] != batch_id for item in client.get('/api/imports').json()['imports'])
        assert _count("SELECT COUNT(*) AS cnt FROM transactions WHERE hash_id = 'imp_c'") == 1
        assert _count("SELECT COUNT(*) AS cnt FROM transactions WHERE hash_id LIKE 'imp_%'") == 1
        assert _count("SELECT COUNT(*) AS cnt FROM manual_records") == 1


def test_delete_import_missing_returns_404(temp_db):
    with TestClient(app) as client:
        assert client.delete('/api/imports/999999').status_code == 404


def test_single_transaction_delete_imported_and_manual(temp_db):
    _insert_imported([('only', '2099-02-01', 'IMPORTATA', -5, 'Fineco')])
    manual_id = _insert_manual('2099-02-02', 'MANUALE', -7)

    with TestClient(app) as client:
        assert client.delete('/api/transactions/only').status_code == 200
        assert client.delete('/api/transactions/only').status_code == 404
        assert client.delete(f'/api/transactions/manual_{manual_id}').status_code == 200
        assert _count("SELECT COUNT(*) AS cnt FROM transactions WHERE hash_id = 'only'") == 0
        assert _count("SELECT COUNT(*) AS cnt FROM manual_records") == 0


def test_update_amount_keeps_sign(temp_db):
    _insert_imported([
        ('spesa', '2099-03-01', 'SPESA', -10, 'Fineco'),
        ('entrata', '2099-03-02', 'ENTRATA', 20, 'Fineco'),
    ])
    manual_id = _insert_manual('2099-03-03', 'MANUALE', -30)

    with TestClient(app) as client:
        assert client.post('/api/transactions/update-amount', json={
            'hash_id': 'spesa', 'amount': 12.5,
        }).status_code == 200
        assert client.post('/api/transactions/update-amount', json={
            'hash_id': 'entrata', 'amount': 25,
        }).status_code == 200
        assert client.post('/api/transactions/update-amount', json={
            'hash_id': f'manual_{manual_id}', 'amount': 40,
        }).status_code == 200

        rows = {row['hash_id']: row for row in client.get('/api/transactions', params={'limit': 50}).json()['transactions']}
        assert rows['spesa']['amount'] == -12.5
        assert rows['entrata']['amount'] == 25
        assert rows[f'manual_{manual_id}']['amount'] == -40

        assert client.post('/api/transactions/update-amount', json={
            'hash_id': 'inesistente', 'amount': 1,
        }).status_code == 404


def test_delete_range_requires_filter(temp_db):
    with TestClient(app) as client:
        assert client.post('/api/transactions/delete-range', json={}).status_code == 400

        result = client.post('/api/transactions/delete-range', json={
            'source': 'Fineco', 'date_from': '2099-04-01', 'date_to': '2099-04-30',
        })
        assert result.status_code == 200
        assert result.json()['deleted_transactions'] == 0


def test_delete_range_filters_source_and_dates(temp_db):
    _insert_imported([
        ('f_apr', '2099-04-10', 'FINECO APRILE', -10, 'Fineco'),
        ('f_mag', '2099-05-10', 'FINECO MAGGIO', -20, 'Fineco'),
        ('r_apr', '2099-04-11', 'REVOLUT APRILE', -30, 'Revolut'),
    ])
    _insert_manual('2099-04-12', 'MANUALE', 100)

    with TestClient(app) as client:
        result = client.post('/api/transactions/delete-range', json={
            'source': 'Fineco', 'date_from': '2099-04-01', 'date_to': '2099-04-30',
        })
        assert result.json()['deleted_transactions'] == 1
        assert _count("SELECT COUNT(*) AS cnt FROM transactions") == 2
        assert _count("SELECT COUNT(*) AS cnt FROM manual_records") == 1

        # Solo il periodo, senza fonte.
        result = client.post('/api/transactions/delete-range', json={
            'date_from': '2099-04-01', 'date_to': '2099-04-30',
        })
        assert result.json()['deleted_transactions'] == 1
        assert _count("SELECT COUNT(*) AS cnt FROM transactions WHERE hash_id = 'f_mag'") == 1


def test_sources_endpoint(temp_db):
    _insert_imported([
        ('s1', '2099-06-01', 'UNO', -1, 'Fineco'),
        ('s2', '2099-06-30', 'DUE', -2, 'Fineco'),
        ('s3', '2099-07-01', 'TRE', -3, 'Revolut'),
    ])
    _insert_manual('2099-07-02', 'MANUALE', 10)

    with TestClient(app) as client:
        sources = client.get('/api/transactions/sources').json()['sources']
        by_name = {item['source']: item for item in sources}
        assert by_name['Fineco']['transactions'] == 2
        assert by_name['Fineco']['first_date'] == '2099-06-01'
        assert by_name['Fineco']['last_date'] == '2099-06-30'
        assert by_name['Revolut']['transactions'] == 1
        assert 'Manuale' not in by_name

        filtered = client.get('/api/transactions', params={'source': 'Fineco'}).json()
        assert filtered['total'] == 2

        # L'anteprima massiva conta solo le importate, non i movimenti manuali.
        window = {'date_from': '2099-06-01', 'date_to': '2099-07-31'}
        assert client.get('/api/transactions', params=window).json()['total'] == 4
        imported_only = client.get('/api/transactions', params={**window, 'imported': True}).json()
        assert imported_only['total'] == 3
        assert all(row['hash_id'].startswith('s') for row in imported_only['transactions'])
