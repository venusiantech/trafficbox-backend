# 📋 TrafficBox API - All Endpoints Summary

## 🔗 Base URL: `http://localhost:5000`

---

## 🔐 **AUTHENTICATION** (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/register-admin` | Register admin user |
| POST | `/api/auth/login` | Login user/admin |

---

## 🎯 **CAMPAIGNS** (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns` | Get all campaigns |
| GET | `/api/campaigns/user/stats` | Get user statistics |
| GET | `/api/campaigns/archived` | Get archived campaigns |
| GET | `/api/campaigns/:id` | Get campaign by ID |
| POST | `/api/campaigns/:id/pause` | Pause campaign |
| POST | `/api/campaigns/:id/resume` | Resume campaign |
| POST | `/api/campaigns/:id/modify` | Modify campaign |
| DELETE | `/api/campaigns/:id` | Archive campaign |
| POST | `/api/campaigns/:id/restore` | Restore campaign |
| GET | `/api/campaigns/:id/stats` | Get campaign statistics |
| GET | `/api/campaigns/:id/report.pdf` | Generate PDF report |

---

## 🔧 **CREDIT MANAGEMENT** (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns/:id/credit-debug` | Debug campaign credits |
| POST | `/api/campaigns/:id/test-credits` | Test credit processing |
| POST | `/api/campaigns/:id/toggle-credit-deduction` | Toggle auto deduction |
| POST | `/api/campaigns/:id/reset-hit-counter` | Reset hit counter |
| POST | `/api/campaigns/:id/reset-counters` | Reset all counters |

---

## 👤 **USER PROFILE** (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get user profile |
| POST | `/api/me/logout` | Logout user |
| GET | `/api/account` | Get 9Hits profile |

---

## 🌐 **WEBSITES** (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/websites` | Add website |
| GET | `/api/websites` | Get all websites |

---

## 🔒 **ADMIN - CAMPAIGNS** (Admin Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/user/:userId/add-credits` | Add credits to user |
| POST | `/api/campaigns/:id/process-credits` | Process campaign credits |
| POST | `/api/campaigns/admin/process-all-credits` | Process all credits |
| POST | `/api/campaigns/admin/migrate-geo-format` | Migrate geo format |

---

## 🔧 **ADMIN - DASHBOARD** (Admin Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Admin dashboard |
| GET | `/api/admin/users` | Get all users |
| GET | `/api/admin/campaigns` | Get all campaigns |
| GET | `/api/admin/users/:userId` | Get user details |
| PUT | `/api/admin/users/:userId/credits` | Update user credits |
| POST | `/api/admin/campaigns/:id/pause` | Force pause campaign |
| POST | `/api/admin/campaigns/:id/resume` | Force resume campaign |
| DELETE | `/api/admin/campaigns/:id` | Delete campaign |
| GET | `/api/admin/analytics` | System analytics |
| GET | `/api/admin/search` | Search users/campaigns |

---

## 📁 **ADMIN - ARCHIVES** (Admin Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/archives/stats` | Archive statistics |
| POST | `/api/admin/archives/cleanup` | Run cleanup job |
| GET | `/api/admin/archives/campaigns` | Get archived campaigns |

---

## 🔑 **TEST CREDENTIALS**

```
Regular User:
Email: azamtest3@gmail.com
Password: test1234

Admin User:
Email: admin@test.com
Password: admin123
```

---

## 📊 **COMMON QUERY PARAMETERS**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `page` | Page number | `?page=1` |
| `limit` | Items per page | `?limit=10` |
| `from` | Start date | `?from=2024-01-01` |
| `to` | End date | `?to=2024-01-31` |
| `status` | Filter by status | `?status=active` |
| `include_archived` | Include archived | `?include_archived=true` |

---

## 🎯 **QUICK TEST SEQUENCE**

1. **Login:** `POST /api/auth/login`
2. **Create Campaign:** `POST /api/campaigns`
3. **Get Campaign:** `GET /api/campaigns/:id`
4. **Pause/Resume:** `POST /api/campaigns/:id/pause`
5. **Get Stats:** `GET /api/campaigns/:id/stats`
6. **Generate Report:** `GET /api/campaigns/:id/report.pdf`

---

## 📝 **NOTES**

- All authenticated endpoints require `Authorization: Bearer TOKEN`
- Admin endpoints require admin role
- Geo format: `[{"country": "US", "percent": 0.5}]`
- PDF reports require puppeteer dependency
- Credit system runs automatically every 5 seconds
