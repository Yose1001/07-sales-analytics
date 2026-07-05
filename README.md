# 📊 Sales Analytics — ระบบวิเคราะห์ยอดขาย

เว็บแอปสำหรับอัปโหลดไฟล์ยอดขาย (CSV) แล้วประมวลผลเบื้องหลังด้วย background worker
ก่อนแสดงผลเป็นแดชบอร์ดสรุปรายได้ สินค้าขายดี และสัดส่วนตามหมวดหมู่

## สารบัญ

1. [ภาพรวมโปรเจค](#1-ภาพรวมโปรเจค)
2. [เทคโนโลยีที่ใช้](#2-เทคโนโลยีที่ใช้)
3. [โครงสร้างโปรเจค](#3-โครงสร้างโปรเจค)
4. [วิธีติดตั้งและรัน](#4-วิธีติดตั้งและรัน)
5. [บัญชีทดสอบ](#5-บัญชีทดสอบ)
6. [รูปแบบไฟล์ CSV](#6-รูปแบบไฟล์-csv)
7. [ตาราง API](#7-ตาราง-api)
8. [จุดเด่นของโปรเจค (สำหรับเล่าตอนสัมภาษณ์)](#8-จุดเด่นของโปรเจค-สำหรับเล่าตอนสัมภาษณ์)
9. [การพัฒนาแบบ local (ไม่ใช้ Docker)](#9-การพัฒนาแบบ-local-ไม่ใช้-docker)

## 1. ภาพรวมโปรเจค

ผู้ใช้สมัครสมาชิก / เข้าสู่ระบบ → อัปโหลดไฟล์ CSV ยอดขาย →
API บันทึกไฟล์แล้วส่งงานเข้า **คิว (Celery + Redis)** → worker ใช้ **pandas**
ตรวจสอบและนำเข้าข้อมูลลง **PostgreSQL** → หน้าแดชบอร์ดดึงสถิติที่ aggregate
ด้วย SQL (พร้อม **Redis cache**) มาแสดงเป็นกราฟ

```
React (nginx :3003) ──/api──▶ FastAPI (:5004) ──▶ PostgreSQL (:5434)
                                   │  ▲
                                enqueue │ อ่าน/เขียน
                                   ▼  │
                          Redis ◀── Celery worker (pandas)
```

## 2. เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18 + TypeScript + Vite, React Router, Recharts, Axios |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| ประมวลผลข้อมูล | pandas + Celery (background worker) |
| ฐานข้อมูล | PostgreSQL 16 + Alembic migration |
| Cache / Queue | Redis 7 (ทั้ง message broker และ cache ผลวิเคราะห์) |
| Auth | JWT + bcrypt |
| Deploy | Docker Compose, nginx multi-stage build + reverse proxy `/api` |

## 3. โครงสร้างโปรเจค

```
07-sales-analytics/
├── docker-compose.yml        # web + api + worker + postgres + redis
├── sample-data/              # ไฟล์ CSV ตัวอย่างสำหรับทดลอง
├── web/                      # React + TypeScript
│   └── src/
│       ├── pages/            # Login, Register, Dashboard, Upload, Uploads
│       ├── components/       # Layout (navbar + outlet)
│       ├── context/          # AuthContext (JWT ใน localStorage)
│       ├── api/              # axios client + interceptor
│       └── types/            # TypeScript interfaces ตรงกับ schema ฝั่ง API
└── api/                      # Python + FastAPI
    ├── alembic/              # database migration
    ├── app/
    │   ├── main.py           # FastAPI app
    │   ├── config.py         # settings จาก env (pydantic-settings)
    │   ├── models/           # SQLAlchemy ORM (โครงตารางใน DB)
    │   ├── schemas/          # Pydantic (validate request/response)
    │   ├── routers/          # auth, uploads, analytics
    │   ├── services/         # business logic + Redis cache
    │   └── workers/          # Celery tasks (pandas ประมวลผล CSV)
    └── tests/                # pytest
```

## 4. วิธีติดตั้งและรัน

ต้องมี Docker Desktop ติดตั้งไว้ก่อน

**ขั้นตอนที่ 1** — clone โปรเจคแล้วเข้าไปที่โฟลเดอร์

```bash
git clone https://github.com/Yose1001/07-sales-analytics.git
cd 07-sales-analytics
```

**ขั้นตอนที่ 2** — build และรันทุก service

```bash
docker compose up -d --build
```

**ขั้นตอนที่ 3** — เปิดใช้งาน

- เว็บแอป: http://localhost:3003
- API docs (Swagger): http://localhost:5004/docs
- ทดลองระบบ: เข้าสู่ระบบด้วยบัญชีทดสอบ แล้วอัปโหลดไฟล์ `sample-data/sales_sample.csv`

## 5. บัญชีทดสอบ

| อีเมล | รหัสผ่าน |
|---|---|
| demo@sales.com | demo123 |

## 6. รูปแบบไฟล์ CSV

ไฟล์ต้องมีหัวคอลัมน์ (ตัวพิมพ์เล็ก): `date, product, category, quantity, unit_price`

```csv
date,product,category,quantity,unit_price
2026-01-05,ลาเต้เย็น,เครื่องดื่ม,12,65
2026-01-06,ครัวซองต์เนยสด,เบเกอรี่,8,75
```

แถวที่ข้อมูลไม่ถูกต้อง (วันที่ผิดรูปแบบ, จำนวนติดลบ ฯลฯ) จะถูกข้ามและรายงานจำนวนให้ทราบ

## 7. ตาราง API

| Method | Endpoint | คำอธิบาย | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | สมัครสมาชิก | - |
| POST | `/api/auth/login` | เข้าสู่ระบบ (รับ JWT) | - |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน | ✅ |
| POST | `/api/uploads` | อัปโหลดไฟล์ CSV (ส่งเข้าคิวประมวลผล) | ✅ |
| GET | `/api/uploads` | รายการไฟล์ที่เคยอัปโหลด | ✅ |
| GET | `/api/uploads/{id}` | สถานะการประมวลผลของไฟล์ | ✅ |
| GET | `/api/analytics/summary` | สรุปรวม: รายได้, จำนวนรายการ, ค่าเฉลี่ย | ✅ |
| GET | `/api/analytics/monthly` | รายได้และจำนวนชิ้นรายเดือน | ✅ |
| GET | `/api/analytics/top-products` | สินค้าขายดี (ค่าเริ่มต้น 10 อันดับ) | ✅ |
| GET | `/api/analytics/by-category` | สัดส่วนรายได้ตามหมวดหมู่ | ✅ |
| GET | `/api/health` | health check | - |

## 8. จุดเด่นของโปรเจค (สำหรับเล่าตอนสัมภาษณ์)

1. **Async background processing** — การประมวลผลไฟล์แยกออกจาก request/response
   cycle ด้วย Celery + Redis ผู้ใช้ไม่ต้องรอไฟล์ใหญ่ประมวลผลเสร็จ และ API
   ตอบกลับทันทีพร้อมสถานะ `pending → processing → done/error` ที่ frontend
   poll ได้
2. **Data pipeline ด้วย pandas** — validate + clean ข้อมูลเป็นชุด (vectorized):
   แปลงชนิดข้อมูลด้วย `errors="coerce"`, ตัดแถวเสีย, รายงานจำนวนแถวที่ข้าม
   แทนที่จะ fail ทั้งไฟล์
3. **Cache-aside pattern** — ผลวิเคราะห์ถูก cache ใน Redis (TTL 5 นาที) และ
   invalidate ทันทีเมื่อมีข้อมูลใหม่ ถ้า Redis ล่ม ระบบยังทำงานได้โดยคำนวณสด
4. **SQL aggregation** — สถิติทั้งหมดคำนวณในฐานข้อมูล (SUM/GROUP BY/DISTINCT)
   ไม่ดึงข้อมูลดิบมาวนลูปในแอป พร้อม index ที่ออกแบบตาม query
5. **แยก Pydantic schema ออกจาก ORM model** — ชั้น validate ขาเข้า/ขาออก
   แยกจากโครงตาราง เป็น separation of concerns ตามแนวทาง FastAPI
6. **Database migration ด้วย Alembic** — โครงสร้างตารางมีเวอร์ชัน ทำซ้ำได้
   ทุกเครื่อง ไม่พึ่ง auto-create
7. **ความปลอดภัย** — รหัสผ่าน hash ด้วย bcrypt, JWT มีวันหมดอายุ, ตรวจ
   ownership ของข้อมูลทุก endpoint (ผู้ใช้เห็นเฉพาะข้อมูลตัวเอง), จำกัดขนาด
   และชนิดไฟล์ที่อัปโหลด

## 9. การพัฒนาแบบ local (ไม่ใช้ Docker)

รัน postgres + redis จาก compose แล้วรันโค้ดบนเครื่องตรง ๆ:

```bash
# terminal 1 — โครงสร้างพื้นฐาน
docker compose up postgres redis

# terminal 2 — API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head && python -m app.seed
uvicorn app.main:app --reload --port 5004

# terminal 3 — Celery worker
cd api && source .venv/bin/activate
celery -A app.workers.celery_app:celery_app worker --loglevel=info

# terminal 4 — frontend (proxy /api ไปที่ :5004 ให้อัตโนมัติ)
cd web
npm install
npm run dev
```

รันเทสต์ฝั่ง API: `cd api && pytest`
