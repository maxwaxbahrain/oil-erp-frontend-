import os

# Configuration
FRONTEND_PAGES = "/Users/abdulqadeer/Desktop/oil-erp-frontend/src/pages"
BACKEND_APP = "/Users/abdulqadeer/Desktop/oil-erp-backend/app"

# Mapping: Frontend Folder Name -> Backend Module Name (snake_case)
MODULE_MAP = {
    'Customers': 'customers',
    'TaxSystem': 'tax_system',
    'Settings': 'settings',
    'Purchases': 'purchases',
    'Portal': 'portal',
    'Ecommerce': 'ecommerce',
    'UserManagement': 'user_management',
    'Sales': 'sales',
    'Dashboard': 'dashboard',
    'Accounts': 'accounts',
    'Inventory': 'inventory',
    'Logistics': 'logistics',
    'Reports': 'reports',
    'VanSales': 'van_sales'
}

def create_safe_structure():
    print("🚀 Starting Safe Gap-Fill Backend Construction...\n")
    
    # Ensure base directories exist
    for base in ['api', 'models', 'schemas']:
        os.makedirs(os.path.join(BACKEND_APP, base), exist_ok=True)

    # Scan Frontend directories
    try:
        frontend_dirs = [d for d in os.listdir(FRONTEND_PAGES) 
                        if os.path.isdir(os.path.join(FRONTEND_PAGES, d)) 
                        and not d.startswith('.')]
    except FileNotFoundError:
        print(f"❌ Error: Frontend directory not found at {FRONTEND_PAGES}")
        return

    created_count = 0
    skipped_count = 0

    for fe_dir in frontend_dirs:
        be_module = MODULE_MAP.get(fe_dir, fe_dir.lower())
        print(f"Checking module: {fe_dir} -> {be_module}...")

        # 1. API ROUTES
        # Pattern: app/api/{module_name}.py  OR app/api/{module_name}/__init__.py
        # We will prefer a folder structure: app/api/{module_name}/routes.py
        api_dir = os.path.join(BACKEND_APP, 'api', be_module)
        os.makedirs(api_dir, exist_ok=True)
        api_init = os.path.join(api_dir, '__init__.py')
        api_file = os.path.join(api_dir, 'routes.py')
        
        # Ensure __init__.py
        if not os.path.exists(api_init):
            with open(api_init, 'w') as f: f.write("")

        # Create routes.py if missing
        if not os.path.exists(api_file):
            print(f"   [+] Creating API Route: {api_file}")
            with open(api_file, 'w') as f:
                f.write(f"""from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...database import get_db
# from ...schemas.{be_module} import {fe_dir}Schema
# from ...models.{be_module} import {fe_dir}Model

router = APIRouter(prefix="/{be_module}", tags=["{fe_dir}"])

@router.get("/")
def get_{be_module}(db: Session = Depends(get_db)):
    return {{"message": "Module {be_module} is active"}}
""")
            created_count += 1
        else:
            print(f"   [=] API Route exists, skipping.")
            skipped_count += 1

        # 2. MODELS
        # Pattern: app/models/{module_name}/models.py
        models_dir = os.path.join(BACKEND_APP, 'models', be_module)
        os.makedirs(models_dir, exist_ok=True)
        model_init = os.path.join(models_dir, '__init__.py')
        model_file = os.path.join(models_dir, 'models.py')

        if not os.path.exists(model_init):
             with open(model_init, 'w') as f: f.write("")

        if not os.path.exists(model_file):
            print(f"   [+] Creating Model: {model_file}")
            with open(model_file, 'w') as f:
                f.write(f"""from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class {fe_dir}Model(Base):
    __tablename__ = "{be_module}"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Add your columns here
""")
            created_count += 1
        else:
            print(f"   [=] Model exists, skipping.")
            skipped_count += 1

        # 3. SCHEMAS
        # Pattern: app/schemas/{module_name}/schemas.py
        schemas_dir = os.path.join(BACKEND_APP, 'schemas', be_module)
        os.makedirs(schemas_dir, exist_ok=True)
        schema_init = os.path.join(schemas_dir, '__init__.py')
        schema_file = os.path.join(schemas_dir, 'schemas.py')

        if not os.path.exists(schema_init):
             with open(schema_init, 'w') as f: f.write("")

        if not os.path.exists(schema_file):
            print(f"   [+] Creating Schema: {schema_file}")
            with open(schema_file, 'w') as f:
                f.write(f"""from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class {fe_dir}Base(BaseModel):
    pass

class {fe_dir}Create({fe_dir}Base):
    pass

class {fe_dir}Response({fe_dir}Base):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
""")
            created_count += 1
        else:
            print(f"   [=] Schema exists, skipping.")
            skipped_count += 1

    print(f"\n✅ Completed.")
    print(f"   Created: {created_count} new files")
    print(f"   Skipped: {skipped_count} existing files")

if __name__ == "__main__":
    create_safe_structure()
