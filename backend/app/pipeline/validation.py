from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class FoodItemSchema(BaseModel):
    id: str = Field(..., description="Unique Food Asset ID, e.g. FD-001, TH-001")
    name: str = Field(..., min_length=2)
    category: str = Field(..., description="Freeze-Dried, Thermostabilized, Natural Form, Bio-regenerative")
    preservation_method: str
    package_type: str
    serving_size_g: float = Field(..., gt=0)
    packaging_mass_g: float = Field(..., ge=0)
    water_to_rehydrate_ml: float = Field(..., ge=0)
    calories_kcal: float = Field(..., ge=0)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    lipids_g: float = Field(..., ge=0)
    vitamin_c_mg: float = Field(..., ge=0)
    thiamine_b1_mg: float = Field(..., ge=0)
    potassium_mg: float = Field(..., ge=0)
    iron_mg: float = Field(..., ge=0)
    shelf_life_nominal_sols_at_21C: int = Field(..., gt=0)
    shelf_life_chilled_sols_at_4C: int = Field(..., gt=0)
    arrhenius_A: float = Field(..., gt=0, description="Arrhenius pre-exponential factor (day^-1)")
    activation_energy_Ea_kJ_mol: float = Field(..., gt=0, description="Activation energy in kJ/mol")
    kinetic_order: int = Field(1, ge=0, le=1)
    sensory_initial_score: float = Field(8.0, ge=0.0, le=10.0)
    storage_temp_recommended_c: float = 4.0

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid = ["Freeze-Dried", "Thermostabilized", "Natural Form", "Bio-regenerative"]
        if v not in valid:
            raise ValueError(f"Category must be one of {valid}")
        return v


class DataAuditReport(BaseModel):
    total_records: int
    categories_breakdown: dict[str, int]
    missing_fields_count: int
    data_quality_score_pct: float
    unit_consistency_verified: bool
    scientific_bounds_passed: bool
    audit_notes: List[str]
