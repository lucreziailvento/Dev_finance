"""Test del data layer: comportamento identico tra SQLite e PostgreSQL."""

import backend.db as db


class FakeCursor:
    """Imita psycopg2: `execute()` restituisce None."""

    def __init__(self, fail_on_call=None, error="duplicate key value"):
        self.calls = []
        self.fail_on_call = fail_on_call
        self.error = error

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        if self.fail_on_call and len(self.calls) == self.fail_on_call:
            raise RuntimeError(self.error)
        return None

    def close(self):
        pass


class FakeConnection:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


def test_execute_returns_cursor_not_driver_result():
    cursor = FakeCursor()

    result = db.execute(cursor, "SELECT %s", (1,))

    assert result is cursor
    assert cursor.calls[0][0] == db.fix_sql("SELECT %s")
    assert cursor.calls[0][1] == (1,)


def test_init_db_ignores_concurrent_duplicate(monkeypatch):
    cursor = FakeCursor(fail_on_call=2)
    connection = FakeConnection()
    monkeypatch.setattr(db, "_new_connection", lambda: (connection, cursor))

    assert db.init_db() is True
    assert connection.rollbacks == 1
    assert len(cursor.calls) > 2
