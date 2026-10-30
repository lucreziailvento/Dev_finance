from pydantic import BaseModel


class DescriptionUpdate(BaseModel):
    hash_id: str
    new_description: str


class CategoryUpdate(BaseModel):
    hash_id: str
    new_micro_category: str


class ForecastEntry(BaseModel):
    date: str
    planned_income: float = 0
    planned_expenses: float = 0
    notes: str = ''


class BudgetAllocationEntry(BaseModel):
    micro_category: str
    planned_amount: float


class ManualRecord(BaseModel):
    date: str
    description: str
    amount: float
    micro_category: str
    type: str


class RuleCreate(BaseModel):
    pattern: str
    micro_category: str
    source: str = ''
    apply_existing: bool = False


class RuleFromTransaction(BaseModel):
    hash_id: str
    micro_category: str = ''
    apply_existing: bool = False
