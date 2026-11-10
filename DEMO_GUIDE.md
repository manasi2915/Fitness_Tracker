# FitTrack - DBMS Level 3 demo guide

Everything below runs on the database that `database/setup_mysql.js` builds. Each demo item is one file, so you can
open it in a notepad and copy the command.

Commands are for **Windows (cmd)**. Use `cmd /c "..."` in PowerShell so that `<` redirection works. The Redis ACL script
(item 9b) needs Git Bash.

---

## 1. One-time setup (before the evaluation)

1. Copy `.env.example` to `.env` and fill in:
   - `DB_PASSWORD` - your MySQL root password
   - `DB_ADMIN_PASSWORD` and `DB_MEMBER_PASSWORD` - new passwords for the two database accounts (`ft_admin`, `ft_member`)
   - `REDIS_MEMBER_PASSWORD` - password for the Redis member user (only for demo 9b)
   `.env` is git-ignored. Passwords are never written into any `.sql` or `.js` file.
2. Start MySQL and Memurai.
3. Install packages once: `npm install` in the project root, then in `backend`, `frontend` and `simulator`.
4. Build the database:
   ```
   node database\setup_mysql.js
   ```
   This creates the tables, the triggers, the procedure, the function, the views, the seed data, the database roles and the two accounts.
   For an existing database, use `node database/migrate.js` to preserve data. Run destructive reset scripts only against a disposable demo copy.
5. Start the app (three terminals, from the project root):
   | Terminal | Command |
   |---|---|
   | 1 | `cd backend` then `npm start` |
   | 2 | `cd frontend` then `npm run dev` (Next.js, http://localhost:3000) |
   | 3 | `node simulator\wearableSimulator.js` |

### Demo accounts (passwords are stored only as bcrypt hashes)

| Who | Email | Password | App role | Database account |
|---|---|---|---|---|
| Demo member | demo@fittrack.com | FitTrackDemo123! | member | - |
| Admin | admin@fittrack.com | Admin@2026 | admin | `ft_admin` (password from `.env`) |
| Member | ravi@fittrack.com | Member@2026 | member | `ft_member` (password from `.env`) |
| Member (trigger demo) | meera@fittrack.com | Member@2026 | member | - |

Only on a disposable seeded demo copy, run `database\demo\00_reset_for_rehearsal.sql` so that item 7 starts from the same point.

---

## 2. The demo, item by item

### Item 1 - How many users, and their roles
```
cmd /c "mysql -u ft_admin -p -h localhost fittrack_db < database\demo\01_users_and_roles.sql"
```
Shows `COUNT(*)` (4 users), counts per role (1 admin, 3 members), the directory view, and the account's database role.
**In the app:** sign in as `admin@fittrack.com` and open **Users & roles**. Same data, with role counts.

### Item 2 - ER diagram
Open `database/docs/ER_DIAGRAM.md` in a Mermaid-capable Markdown viewer or GitHub (source: `er_diagram.mmd`). The PNG/SVG next to it are the same complete 15-table diagram, ready to show or print.

### Item 3 - How the ER diagram became a relational schema
Open `database\docs\RELATIONAL_SCHEMA.md` (sections 1 to 3: mapping rules, schema, data dictionary).
To show the real database, run:
```
cmd /c "mysql -u ft_admin -p -h localhost fittrack_db < database\demo\02_schema_inspection.sql"
```
It lists the tables, primary and foreign keys, CHECK and UNIQUE constraints, triggers, procedures and functions.

### Item 4 - Mapping of backend tables to the UI
Open `database\docs\UI_TABLE_MAPPING.md`. One row per screen: the API it calls, the controller, the tables it reads or writes.

### Item 5 - Create / update / delete on every table
```
cmd /c "mysql -u ft_admin -p -h localhost fittrack_db < database\demo\03_crud_all_tables.sql"
```
Inserts and updates rows in all 15 tables (the 10 core tables and `habits`, `habit_checkins`, `workout_schedule`, `coaches`, `subscriptions`), shows one row count per table, then deletes them again (children first).
The final line should show `leftover 0`. Every line is also in the file, so you can copy any single command into the notepad.

### Item 6 - Queries
```
cmd /c "mysql -u ft_admin -p -h localhost fittrack_db < database\queries.sql"
```
19 labelled queries (15-18 use the habit, schedule and coach tables: recursive-CTE habit streaks, coach subscribers with completion %, habits not yet checked in today, scheduled workouts for the next 7 days; 19 is the SQL half of the weekly report): inner join, aggregates with GROUP BY and HAVING, subqueries (NOT IN and NOT EXISTS), a transaction with rollback,
a correlated subquery, two CTEs (`WITH` and `WITH RECURSIVE`), ORDER BY with LIMIT, window `RANK()`, the view, and `EXPLAIN` showing the index.

### Item 7 - Trigger and procedure, data before and after
Reset first (only needed after a previous run):
```
cmd /c "mysql -u ft_admin -p -h localhost fittrack_db < database\demo\00_reset_for_rehearsal.sql"
```
Trigger:
```
cmd /c "mysql -u ft_admin -p -h localhost --force fittrack_db < database\demo\04_trigger_before_after.sql"
```
- **Before:** Meera's weekly goal (target 2) is `active`, and her session 3 is still open.
- **After:** one `UPDATE` on the session. The goal becomes `completed`, and two rows appear in `activity_log`.
- The last statement is refused by the second trigger ("Session is already finished"). That error is expected.

Procedure and function:
```
cmd /c "mysql -u ft_admin -p -h localhost --force fittrack_db < database\demo\05_procedure_function.sql"
```
The function returns session 1's volume (3680 kg). The procedure promotes Ravi to admin and reverts it, and each change is written to `role_audit_log`.
The last-admin refusal is expected.

**Why this trigger is specific to FitTrack:** it implements the fitness rule "a workout counts toward a weekly goal once it is finished,
and the goal completes when the target is reached". It is not a generic audit trigger. The API's goal progress uses the same rule.

### Item 8 - One complex nested query
```
cmd /c "mysql -u ft_admin -p -h localhost fittrack_db < database\demo\07_nested_query.sql"
```
Members who have an active goal and whose average session volume is above the gym-wide average. Three levels of nesting plus an `EXISTS`.
Expected result: Demo User, average 3680 kg.

### Item 9 - Redis (Memurai) create, read, update, delete
```
cmd /c "redis-cli -h 127.0.0.1 -p 6379 < database\demo\08_redis_crud.txt"
```
Creates a journal entry (string JSON), a daily activity hash and a sensor stream entry. Then reads, updates (`SET ... XX`, `HINCRBY`) and deletes them.
The commands are plain lines, so you can paste them one by one.

Redis role-based access (item 9b, Git Bash):
```
export REDIS_MEMBER_PASSWORD='the value from your .env'
bash database/demo/09_redis_acl.sh
```
The demo Redis role can access all allowed FitTrack key prefixes; per-user ownership is enforced by the API. It gets `NOPERM` on other keys and on `FLUSHALL`/`KEYS`.

### Item 10 - Modifications
The database is rebuilt in one command (`node database\setup_mysql.js`). Each part is a separate file, so changes are quick to make.

---

## 3. Role-based access in the database (rubric: at least 2 roles)

```
cmd /c "mysql -u ft_member -p -h localhost --force fittrack_db < database\demo\06_rbac_member_denied.sql"
```
As the member account:
- **allowed:** reading names and roles, reading sets, and editing permitted working tables (row ownership is enforced by the API)
- **denied:** `SELECT * FROM users` and `password_hash`, deleting an exercise, changing a role, calling `sp_change_role`, reading the audit log, `DROP TABLE`

The two database roles are `fittrack_admin` and `fittrack_member` (`database/security/roles.sql`). The accounts are created by `database/security/create_db_accounts.js`.

---

## 4. Coverage of the supplied guidelines

The requirements draft does not assign marks; the separate Level 3 evaluation criteria do (50 marks). [REVIEW_READINESS.md](REVIEW_READINESS.md) maps each rubric line to evidence and has the requirement-by-requirement comparison, scope, architecture, contribution record and a 12-minute presentation sequence.

The application demonstrates five advanced categories: transactions, views, stored procedures/functions, triggers and indexes. The optional synopsis features, heart-rate anomaly detection and weekly reports, are implemented (see below). Vector search is optional and not implemented.

### New synopsis features

Open **Habits & schedule**: add a daily habit and toggle its check-in; inspect the seven-day completion count; schedule an existing workout plan; subscribe/unsubscribe to a fictional coach. SQL evidence is in `database/extensions.sql`, API evidence in `backend/src/routes/routineRoutes.js`, and the updated ER source in `database/docs/er_diagram.mmd`.

### Heart-rate alerts and weekly report

Start the simulator, sign in as the Demo User and open **Weekly report**.
- **Weekly report**: seven UTC days with steps and calories (Redis daily hashes), finished workouts, minutes and lifted volume (`v_session_summary` / `fn_session_volume`), habit check-ins and scheduled workouts (MySQL), and heart-rate alerts (Redis stream). **Download CSV** saves the same table. Change **Week ending** to view an earlier week.
- **Heart-rate anomaly alerts**: the API reads the date of birth from `user_profiles`, estimates a maximum heart rate (220 - age), then checks every reading in the Redis stream for the chosen period. A reading is flagged when it is at least 85% of that maximum, above 100 bpm while resting, or below 40 bpm. The simulator occasionally produces a resting spike so the resting rule can be shown.
- Code: `backend/src/routes/reportRoutes.js`, rules in `backend/src/utils/heartRate.js`, page `frontend/src/views/Reports.jsx`. The SQL half of the report is query 19 in `database/queries.sql`.

### Automated verification

```
npm test
npm run test:integration
npm run build
```

Integration tests create and remove a separate random database; they do not reset your project data. See `TEST_RESULTS.md` for actual results and remaining limitations.

### Redis in WSL / repeatable startup

Keep a WSL terminal open during the presentation. Inside WSL, run `redis-cli ping` (expected `PONG`); if necessary, run `sudo service redis-server start`. Wait for Windows localhost forwarding to become available. Build the frontend once, then run `powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1` from the project root. Run the simulator separately. Check `http://localhost:5000/api/health` before the demo.

---

## 5. Security notes

- Keep `.env` local and ignored. JWT_SECRET must be randomly generated and at least 32 characters; the API rejects the former development fallback.
- Database accounts (`ft_admin`, `ft_member`) and the Redis member user take their passwords from `.env` or from your shell only.
- Passwords in the database are bcrypt hashes. `show_users.js` shows only the first characters of the hash.
- Row ownership (a member editing only their own rows) is enforced by the API. MySQL has no built-in row-level security.
