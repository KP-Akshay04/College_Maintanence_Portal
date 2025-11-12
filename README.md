College Maintenance Request Management - Ready-to-run (SQLite)
------------------------------------------------------------
Steps to run:
1. Create and activate a Python virtual environment (recommended).
   python -m venv venv
   # Windows: venv\Scripts\activate
   # macOS/Linux: source venv/bin/activate
2. Install dependencies:
   pip install django==4.2 django-crispy-forms crispy-bootstrap5
3. Run migrations:
   python manage.py migrate
4. Create initial users (Principal + 6 HODs) by running the helper script AFTER migrations:
   python create_users.py
   This will create:
     - Principal (username: principal, password: Principal@123)
     - HOD users:
       hod_cse / HodCse@123
       hod_ece / HodEce@123
       hod_mech / HodMech@123
       hod_civil / HodCivil@123
       hod_eee / HodEee@123
       hod_it / HodIt@123
5. Run server:
   python manage.py runserver
6. Login:
   - Admin dashboard: http://127.0.0.1:8000/admin-dashboard/  (login via /accounts/login/)
   - Django admin: http://127.0.0.1:8000/admin/ (principal user is staff/superuser)
Notes:
- The create_users.py script requires that migrations have been applied first.
- If you want a pre-populated sqlite DB instead, ask me and I can include db.sqlite3 directly.
