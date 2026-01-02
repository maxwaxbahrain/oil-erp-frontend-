import os
import shutil

# Define paths
FRONTEND_PAGES_DIR = "/Users/abdulqadeer/Desktop/oil-erp-frontend/src/pages"
BACKEND_APP_DIR = "/Users/abdulqadeer/Desktop/oil-erp-backend/app"

# Map frontend folder names to backend snake_case names
MODULE_MAPPING = {
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

def create_backend_structure():
    print("Starting structure synchronization...")
    
    # Get all directories in frontend pages
    try:
        frontend_modules = [d for d in os.listdir(FRONTEND_PAGES_DIR) 
                          if os.path.isdir(os.path.join(FRONTEND_PAGES_DIR, d))]
    except FileNotFoundError:
        print(f"Error: Frontend pages directory not found at {FRONTEND_PAGES_DIR}")
        return

    for module in frontend_modules:
        if module.startswith('.'): continue
        
        backend_name = MODULE_MAPPING.get(module, module.lower())
        print(f"Processing Frontend: {module} -> Backend: {backend_name}")
        
        # Create directories in api, models, services, schemas
        for layer in ['api', 'models', 'schemas', 'services']:
            dir_path = os.path.join(BACKEND_APP_DIR, layer, backend_name)
            os.makedirs(dir_path, exist_ok=True)
            
            # Create __init__.py
            init_file = os.path.join(dir_path, '__init__.py')
            if not os.path.exists(init_file):
                with open(init_file, 'w') as f:
                    f.write("")
            
            # Create placeholder files to ensure structure is visible
            # e.g. api/tax_system/routes.py
            if layer == 'api':
                layer_file = os.path.join(dir_path, 'routes.py')
                if not os.path.exists(layer_file):
                    with open(layer_file, 'w') as f:
                        f.write(f"from fastapi import APIRouter\n\nrouter = APIRouter()\n\n@router.get('/')\ndef get_{backend_name}():\n    return {{'message': '{backend_name} module active'}}\n")
            
            elif layer == 'models':
                layer_file = os.path.join(dir_path, 'models.py')
                if not os.path.exists(layer_file):
                    with open(layer_file, 'w') as f:
                        f.write(f"from sqlalchemy import Column, Integer, String\nfrom ...database import Base\n\n# class {module}Model(Base):\n#     __tablename__ = '{backend_name}'\n#     id = Column(Integer, primary_key=True, index=True)\n")

            elif layer == 'schemas':
                layer_file = os.path.join(dir_path, 'schemas.py')
                if not os.path.exists(layer_file):
                    with open(layer_file, 'w') as f:
                        f.write(f"from pydantic import BaseModel\n\nclass {module}Base(BaseModel):\n    pass\n")

    print("\nBackend structure synchronization completed.")
    print("Verifying directories...")
    created_dirs = os.listdir(os.path.join(BACKEND_APP_DIR, 'api'))
    print(f"API Modules present: {created_dirs}")

if __name__ == "__main__":
    create_backend_structure()
