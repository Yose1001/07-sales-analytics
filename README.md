# Sales Analytics — ระบบวิเคราะห์ยอดขาย

เว็บแอปวิเคราะห์ยอดขาย: อัปโหลดไฟล์ยอดขาย (CSV) แล้วระบบประมวลผลเบื้องหลังด้วย
background worker ก่อนแสดงผลเป็นแดชบอร์ดสรุปรายได้ สินค้าขายดี และสัดส่วนตามหมวดหมู่

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [เทคโนโลยีที่ใช้](#2-เทคโนโลยีที่ใช้)
3. [วิธีติดตั้งและใช้งาน](#3-วิธีติดตั้งและใช้งาน)
4. [บัญชีทดสอบ](#4-บัญชีทดสอบ)
5. [รูปแบบไฟล์ CSV](#5-รูปแบบไฟล์-csv)
6. [API ทั้งหมด](#6-api-ทั้งหมด)
7. [โครงสร้างฐานข้อมูล](#7-โครงสร้างฐานข้อมูล)
8. [จุดเด่นของโปรเจค (สำหรับเล่าตอนสัมภาษณ์)](#8-จุดเด่นของโปรเจค-สำหรับเล่าตอนสัมภาษณ์)

## 1. ภาพรวมระบบ

**ฝั่งผู้ใช้**

- สมัครสมาชิก / เข้าสู่ระบบ (JWT)
- อัปโหลดไฟล์ CSV ยอดขาย พร้อมดูสถานะการประมวลผลแบบ real-time
  (`pending → processing → done/error`)
- ดูประวัติไฟล์ที่เคยอัปโหลด จำนวนแถวที่นำเข้า และแถวที่ถูกข้าม
- แดชบอร์ดสรุป: รายได้รวม, รายได้รายเดือน (กราฟเส้น), สินค้าขายดี (กราฟแท่ง),
  สัดส่วนตามหมวดหมู่ (กราฟวงกลม)

**ระบบเบื้องหลัง**

- การประมวลผลไฟล์แยกออกจาก request/response — API ส่งงานเข้าคิว (Celery + Redis)
  แล้ว worker ใช้ pandas ตรวจสอบ ทำความสะอาด และนำเข้าข้อมูลลง PostgreSQL
- ผลวิเคราะห์ cache ใน Redis (TTL 5 นาที) และ invalidate อัตโนมัติเมื่อมีข้อมูลใหม่

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
| Frontend | React 18 + TypeScript + Vite, React Router, Recharts |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| ประมวลผลข้อมูล | pandas + Celery (background worker) |
| Database | PostgreSQL 16 + Alembic migration |
| Cache / Queue | Redis 7 (message broker ของ Celery + cache ผลวิเคราะห์) |
| Auth | JWT (PyJWT) + bcrypt |
| Deploy | Docker Compose + nginx (multi-stage build, reverse proxy `/api`) |
| Test | pytest |

## 3. วิธีติดตั้งและใช้งาน

### ขั้นตอนที่ 1 — รันทั้งระบบด้วย Docker (แนะนำ)

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| เว็บ | http://localhost:3003 |
| API (Swagger docs ที่ `/docs`) | http://localhost:5004 |
| PostgreSQL | localhost:5434 (user: sales / pass: salespass) |

เปิดเว็บแล้ว login ได้ทันทีด้วยบัญชีทดสอบ:

| อีเมล | รหัสผ่าน |
|---|---|
| demo@sales.com | demo123 |

จากนั้นทดลองอัปโหลดไฟล์ `sample-data/sales_sample.csv` แล้วเปิดหน้าแดชบอร์ด

### ขั้นตอนที่ 2 — รันแบบ dev (แก้โค้ดแล้วเห็นผลทันที)

ต้องมี Python 3.12+, Node 20+ และ PostgreSQL + Redis
(ใช้ตัวใน Docker ได้: `docker compose up -d postgres redis`)

```bash
# backend API (terminal 1)
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head && python -m app.seed
uvicorn app.main:app --reload --port 5004

# Celery worker (terminal 2)
cd api && source .venv/bin/activate
celery -A app.workers.celery_app:celery_app worker --loglevel=info

# frontend (terminal 3 — proxy /api ไปที่ :5004 ให้อัตโนมัติ)
cd web
npm install
npm run dev        # เปิด http://localhost:3003
```

### ขั้นตอนที่ 3 — รัน unit test

```bash
cd api
pytest
```

## 4. บัญชีทดสอบ

ระบบ seed บัญชีทดสอบให้อัตโนมัติตอน start (ตารางในขั้นตอนที่ 1)
สมัครสมาชิกใหม่เพิ่มได้จากหน้าเว็บ — ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลยอดขายของตัวเอง

## 5. รูปแบบไฟล์ CSV

ไฟล์ต้องมีหัวคอลัมน์ (ตัวพิมพ์เล็ก): `date, product, category, quantity, unit_price`

```csv
date,product,category,quantity,unit_price
2026-01-05,ลาเต้เย็น,เครื่องดื่ม,12,65
2026-01-06,ครัวซองต์เนยสด,เบเกอรี่,8,75
```

- รองรับเฉพาะ `.csv` ขนาดไม่เกิน 20 MB
- แถวที่ข้อมูลไม่ถูกต้อง (วันที่ผิดรูปแบบ, จำนวนติดลบ ฯลฯ) จะถูกข้าม
  และรายงานจำนวนให้ทราบ — ไม่ fail ทั้งไฟล์

ไฟล์ในโฟลเดอร์ `sample-data/`:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `sales_template.csv` | แบบฟอร์มเปล่า (มีเฉพาะหัวคอลัมน์) สำหรับกรอกข้อมูลจริงแล้วอัปโหลด |
| `sales_sample.csv` | ข้อมูลตัวอย่าง 39 แถว สำหรับทดลองระบบทันที |

## 6. API ทั้งหมด

### Auth (`/api/auth`)

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/auth/login` | เข้าสู่ระบบ รับ JWT |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน |

### อัปโหลดไฟล์ (ต้อง login)

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/uploads` | อัปโหลดไฟล์ CSV → ส่งเข้าคิวประมวลผล ตอบกลับทันที |
| GET | `/api/uploads` | รายการไฟล์ที่เคยอัปโหลด |
| GET | `/api/uploads/{id}` | สถานะการประมวลผลของไฟล์ (frontend ใช้ poll) |

### วิเคราะห์ยอดขาย (ต้อง login)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/analytics/summary` | สรุปรวม: รายได้, จำนวนรายการ, ค่าเฉลี่ยต่อรายการ |
| GET | `/api/analytics/monthly` | รายได้และจำนวนชิ้นรายเดือน |
| GET | `/api/analytics/top-products?limit=10` | สินค้าขายดีเรียงตามรายได้ |
| GET | `/api/analytics/by-category` | สัดส่วนรายได้ตามหมวดหมู่ |

### อื่น ๆ

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/health` | health check |

## 7. โครงสร้างฐานข้อมูล

จัดการ schema ด้วย Alembic migration (`api/alembic/versions`)

- **users** — ผู้ใช้ (email ไม่ซ้ำ, รหัสผ่าน hash ด้วย bcrypt)
- **uploads** — ไฟล์ที่อัปโหลด เก็บสถานะการประมวลผล
  (`pending → processing → done/error`), จำนวนแถวที่นำเข้า/ถูกข้าม
  และข้อความ error กรณีไฟล์ใช้ไม่ได้
- **sales** — รายการขายที่ผ่านการตรวจสอบแล้ว อ้างอิงกลับไปยังไฟล์ต้นทาง
  (`upload_id`) และเจ้าของข้อมูล (`user_id`) มี index ที่ `user_id`,
  `sale_date`, `category` ตามรูปแบบ query ของแดชบอร์ด

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
   ทุกเครื่อง ไม่พึ่ง auto-create (แนวคิดเดียวกับ Flyway ในโปรเจค 06)

7. **ความปลอดภัย** — รหัสผ่าน hash ด้วย bcrypt, JWT มีวันหมดอายุ, ตรวจ
   ownership ของข้อมูลทุก endpoint (ผู้ใช้เห็นเฉพาะข้อมูลตัวเอง), จำกัดขนาด
   และชนิดไฟล์ที่อัปโหลด
