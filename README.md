# NEXORA AITOS™

**AI Trading Operating System** — แพลตฟอร์ม 15 หน้า ครอบคลุมตั้งแต่การวิเคราะห์ตลาด
ไปจนถึงการบริหารกองทุนและการตัดสินใจระดับผู้บริหาร
Next.js 16 (App Router) + TypeScript + Tailwind v4 + lightweight-charts

## 15 หน้าของแพลตฟอร์ม

| # | หน้า | เส้นทาง | แก่นของหน้า |
|---|---|---|---|
| 01 | Command Center | `/` | ศูนย์บัญชาการหลัก · Master AI Decision · WHY? |
| 02 | AI 50 Network | `/ai-network` | AI 50 ตัวใน 10 pod · Trust Score · Voting |
| 03 | Coin Intelligence | `/markets` | วิเคราะห์รายสินทรัพย์ 9 ปัจจัย · Consensus Engine |
| 04 | Live Execution | `/execution` | Paper engine · Smart Order Routing 5 venue |
| 05 | Portfolio Intelligence | `/portfolio` | Exposure · Correlation · Stress Test · Digital Twin |
| 06 | AI Strategy Lab | `/strategies` | **Backtest จริง** · Monte Carlo · Walk Forward · Code Gen |
| 07 | Risk Engine | `/risk` | คณะกรรมการ 10 เสียง · Black Swan · Capital Preservation |
| 08 | AI Learning Center | `/ai-learning` | Feature importance · Pattern mining · Drift · AI Research Scientist |
| 09 | Global Market Intelligence | `/market-intelligence` | มหภาคจริง 24 สัญลักษณ์ · Event Radar |
| 10 | AI Autonomous Center | `/autonomous` | 5 โหมดอัตโนมัติ · AI Constitution · Mission Recorder |
| 11 | Performance Analytics | `/performance` | Attribution · Trade analytics · Performance Twin |
| 12 | Fund Operations | `/fund` | **AI-CIO** จัดสรรทุน · ค่าธรรมเนียม · Compliance |
| 13 | AI War Room | `/war-room` | WAR MODE · Threat board · **Crisis Simulator** |
| 14 | System Operations | `/system-ops` | **Telemetry เซิร์ฟเวอร์จริง** · API Monitor · **AI-CTO** |
| 15 | Executive Center | `/executive` | **Digital CEO** · Board Room · **Company Digital Twin** |
| 16 | Backtesting Center | `/backtest` | **จำลองต้นทุนครบ** — Funding · Slippage · Liquidation · Regime · Trade Replay |
| 17 | Trade History | `/history` | **ประวัติจากการจำลอง (PAPER)** บนราคาจริง · ตัวกรอง · Replay · AI Post-Trade · Audit |
| 18 | Alerts Center | `/alerts` | **ตรวจจับสดทุก 20 วิ** — 15 กฎบนข้อมูลจริง · Dedup · Auto-resolve · Audit · ช่องทาง/สิทธิ์ |
| 19 | Settings | `/settings` | **บันทึกจริงลง localStorage** · 12 แท็บตามสิทธิ์ · Security Score · Risk Impact · **ไม่รับ API Key** · Audit เดิม→ใหม่ |

## รันโปรเจกต์

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

ไม่ต้องใช้ API key — ทุกแหล่งข้อมูลเป็น public endpoint

> ⚠️ **พาธโปรเจกต์ต้องสั้น** ต้องอยู่ในโฟลเดอร์เช่น `C:\Users\<user>\Claude\Projects\`
> ถ้าวางใต้ OneDrive + ชื่อโฟลเดอร์ภาษาไทย Turbopack จะเขียน chunk ไม่ได้ (เกิน MAX_PATH ของ Windows)

## PAGE 01 — COMMAND CENTER

หน้าแรกหลัง login ตอบ 5 คำถามภายใน 5 วินาที: ระบบปลอดภัยไหม · AI 50 ตัวทำอะไรอยู่ ·
พอร์ตกำไรหรือขาดทุน · ควรเข้าเทรดไหม · มีอะไรผิดปกติไหม

| ส่วน | รายละเอียด |
|---|---|
| **Top Bar** | โลโก้ NEXORA AITOS · ค้นหาสินทรัพย์ (เปลี่ยนทั้งแดชบอร์ด) · สถานะ 5 Exchange · Server · วง AI ONLINE 50/50 · นาฬิกา UTC+7 · แจ้งเตือน · โปรไฟล์ |
| **Left Menu** | 12 เมนู + ปุ่ม EMERGENCY STOP (ยืนยัน 2 ขั้น) |
| **Portfolio Overview** | Equity · กำไรวันนี้ · Win Rate · Profit Factor · Sharpe · Drawdown · Free Margin · Leverage · Margin Usage + Equity Curve |
| **Live Positions** | Entry/Stop/TP/PnL/Confidence/Holding — คลิกแถวเพื่อดูว่า AI ตัวไหน Approve/Reject |
| **Trading Chart** | 9 ไทม์เฟรม `1S 5S 15S 1M 5M 15M 1H 4H 1D` + 7 overlay เปิดปิดได้ |
| **AI Network** | 50 เอเจนต์ใน 10 pod พร้อมไฟสถานะ 5 แบบ (Online/Thinking/Voting/Waiting/Offline) |
| **Risk Engine** | เกจ Margin Ratio + ตารางเพดานความเสี่ยง |
| **Master AI Decision** | LONG/SHORT/WAIT · Confidence · R:R · Position Size · Entry/SL/TP · หลักฐาน 6 ข้อ + ปุ่ม **WHY?** |
| **AI Activity Flow** | ไปป์ไลน์ Exchange → Data → Trend → Smart Money → ML → Risk → Master → Execution → Exchange |
| **Coin Heatmap** | 7 เหรียญ พร้อม Momentum · Funding · Volume · AI Score |
| **Top AI Today** | อันดับ AI ตามผลงาน 24H |
| **Footer** | Server · Latency · Exchange latency · API · Market Data · Venues · Execution |

## PAGE 02 — AI 50 NETWORK

ศูนย์ควบคุม "สมอง" ของระบบ ไม่ได้ใช้เทรดโดยตรง แต่ใช้ตรวจสอบและควบคุม AI ทั้ง 50 ตัว

| ส่วน | รายละเอียด |
|---|---|
| **AI Summary** | AI ONLINE 50/50 + จำนวนแยกตามสถานะ (คิด/โหวต/ส่งคำสั่ง/เรียนรู้/รอคิว/หยุด/ออฟไลน์) + ค้นหา + กรองตามกลุ่ม |
| **AI Network Map** | AI 50 ตัวจัด 10 pod รอบ Master Hub · คลิกดูรายละเอียด · เส้นวิ่งเมื่อ AI กำลังทำงาน |
| **AI Details** | สถานะ · เวอร์ชัน · Accuracy · Win Rate · Holding · Decisions/Trades/Profit · CPU/GPU/RAM/Latency · Exchange · **Trust Score** + ปุ่มควบคุม 6 ปุ่ม (Pause ใช้งานได้จริง) |
| **Master AI** | มติล่าสุด + ปุ่ม WHY? (แผงเดียวกับหน้า 01) |
| **AI Timeline** | Flight recorder — ไล่ย้อนจาก Market Data → OrderBook → Trend → Whale → OI → Risk → Master → Execution |
| **AI Voting** | คณะกรรมการ AI 8 เสียง พร้อมน้ำหนักและเหตุผล |
| **Resource Usage** | CPU/GPU/RAM รวมของกอง + Latency จริง + สถานะ Database/Redis/Kafka/WebSocket/API |
| **Performance Ranking** | อันดับ AI ตามกำไรวันนี้ พร้อม Trust Score |
| **AI Relationship Graph** | ผังการไหลของข้อมูล Exchange → Data → Feature → 4 pod วิเคราะห์ → ML → Risk → Master → Execution → Exchange พร้อมอนิเมชัน |

### AI Trust Score

น้ำหนักที่ Master AI ควรให้ AI แต่ละตัว คิดจาก 6 ปัจจัย —
ความแม่นยำย้อนหลัง 26% · ผลตอบแทนจริง 24% · Max Drawdown 18% ·
ความเสถียรของโมเดล 14% · ความสดของโมเดล (วันตั้งแต่ฝึกล่าสุด) 10% · คุณภาพข้อมูล 8%
โมเดลที่ไม่ได้ฝึกใหม่นานจะเสียน้ำหนักแม้ Accuracy ยังดูดี

## PAGE 03 — COIN INTELLIGENCE

วิเคราะห์สินทรัพย์เดียวแบบเจาะลึกในหน้าเดียว (`/markets`)

| ส่วน | รายละเอียด |
|---|---|
| **Coin Profile** | ราคา · 24H · Volume · OI · Funding · Whale · ความผันผวน · Regime · Confidence · Fear&Greed · correlation NASDAQ/ทองคำ |
| **Top by AI Score** | คัดกรองคริปโต / หุ้นไทย / หุ้นต่างประเทศ เรียงตามคะแนน + รายการโปรด |
| **AI Coin Analysis** | คะแนนรวม 0-100 จาก 9 ปัจจัย + AI Summary + ปุ่ม WHY? |
| **Consensus Engine** | AI ทั้ง 50 ตัวโหวต แสดง "38 จาก 50 สนับสนุน LONG" หรือ "เสียงแตก 14 ต่อ 12" แยกรายกลุ่ม |
| **Order Book Intelligence** | Bid/Ask · Buy Wall · Liquidity Wall · Spread · Book Pressure · ตรวจ Spoofing · Liquidity Score |
| **Smart Money** | Whale Buy · Taker Delta · Delta ไม้ใหญ่ · สัดส่วน Large Order · Accumulation/Distribution |
| **Futures Intelligence** | Funding · OI + การเปลี่ยนแปลง · Long/Short · Mark · Basis/Premium · โซนบังคับปิด |
| **On-Chain Intelligence** | Hash Rate · Hash Ribbon · ธุรกรรม · Block Time · มูลค่าโอนบนเชน · อุปทาน + Fear & Greed |
| **AI Entry / Exit** | Direction · Entry · SL · TP1-3 พร้อม RR · ขนาดไม้ · Leverage · ปุ่ม Open/Paper/Watchlist |
| **Risk Analysis** | Risk Meter + 9 มิติความเสี่ยง |
| **AI Reasoning** | อธิบายการตัดสินใจเป็นภาษาไทย อ้างอิงตัวเลขจริงบนหน้าเดียวกัน |
| **News Intelligence** | ข่าวเจาะจงสินทรัพย์ + คะแนนอารมณ์ + ระดับผลกระทบ |
| **AI Replay** | บันทึกสิ่งที่ AI คิดทุกครั้งที่ราคาอัปเดต ย้อนดูได้ 1 นาที / 5 นาที / 1 ชม. / 1 วัน |

### AI Score 9 ปัจจัย

แนวโน้ม 20% · โมเมนตัม 14% · แรงซื้อรายใหญ่ 13% · ML 12% · สภาพคล่อง 10% ·
ค่าธรรมเนียม 9% · ความเสี่ยง 9% · มหภาค 7% · ข่าว 6%
ปัจจัยที่ไม่มีข้อมูลจะใช้ค่ากลาง 50 และติดป้าย "ไม่มีข้อมูล" เสมอ — ฟีดที่ขาดหายจะไม่ถูกนับเป็นสัญญาณบวก

## PAGE 04 — LIVE EXECUTION CENTER

ศูนย์ควบคุมการส่งคำสั่ง (`/execution`) — **เป็น paper engine ไม่มีคำสั่งใดออกจากเบราว์เซอร์**

| ส่วน | รายละเอียด |
|---|---|
| **Exchange Monitor** | สถานะ 5 venue พร้อมราคาและ latency ที่วัดจริง + AUTO MODE + EMERGENCY STOP |
| **Execution Flow** | ไปป์ไลน์ 9 ขั้น สว่างตามสถานะจริงของคำสั่งล่าสุด |
| **Smart Order Entry** | MARKET / LIMIT / STOP / OCO / TWAP / VWAP · ขนาดอิงสภาพคล่องที่มองเห็น · TP/SL · Reduce Only · Post Only |
| **Active Orders** | บลอตเตอร์พร้อมตัวกรอง 6 สถานะ · ยกเลิกได้ |
| **Order Detail** | 17 ฟิลด์ + Raw JSON response + ปุ่ม **Explain Execution** พร้อมตารางจัดอันดับ venue |
| **Position Manager** | สถานะสุทธิจากคำสั่งที่จับคู่จริง · Trailing Stop · Break Even · ปิด 20/30/50/100% |
| **TP / SL Manager** | บันได TP1-3 + SL คำนวณจากราคาเข้าจริงและ RR ของ Master AI |
| **Execution Timeline** | ทุกขั้นระดับมิลลิวินาที พร้อม +delta และเวลารวม |
| **Smart Order Routing** | จัดอันดับ venue จากราคา 45% · latency 25% · fee 15% · ความลึก 15% |
| **Execution Statistics & AI Analysis** | สถิติ 8 ตัว + คะแนนคุณภาพ 5 ด้าน คำนวณจากคำสั่งที่ส่งจริงในเซสชัน |

### สิ่งที่จริงและสิ่งที่จำลอง

**จริง:** ราคาและ latency ของทั้ง 5 venue (Binance · Bybit · OKX · Bitget · Kraken ผ่าน public API) ·
การเลือก venue จากราคาที่ดีที่สุดจริง · ราคาที่จับคู่จากการเดินสมุดคำสั่งจริงของ Binance ·
สลิปเพจที่คำนวณจากราคาเฉลี่ยเทียบ mid · เวลาที่รอ exchange ตอบกลับ (ใช้ latency ที่วัดได้จริง)

**จำลอง:** การส่งคำสั่งออกไปยัง exchange — ไม่มีการเชื่อม API key และไม่มีคำสั่งใดออกจากเบราว์เซอร์
ทุกแผงติดป้าย `PAPER`

**ข้อจำกัดที่ระบุไว้ในหน้า:** ระบบมี depth เฉพาะของ Binance ราคาที่จับคู่จึงคำนวณจากสมุดของ Binance
แม้การเลือกตลาดจะชี้ไป venue อื่น — ต้องต่อ WebSocket แยกต่อ exchange จึงจะแก้ได้

## แหล่งข้อมูล

| ประเภท | แหล่ง | หมายเหตุ |
|---|---|---|
| คริปโตสปอต (ราคา/แท่งเทียน/order book/trades) | Binance `api.binance.com` (fallback `data-api.binance.vision`) | เรียลไทม์ |
| คริปโตฟิวเจอร์ส (funding, OI history, long/short) | Binance `fapi.binance.com` | เรียลไทม์ |
| หุ้นไทย SET · หุ้นต่างประเทศ · ดัชนี · ทอง/น้ำมัน/ค่าเงิน | Yahoo Finance `v8/finance/chart` | ล่าช้า ~15 นาที |
| สถานะ Exchange | ping จริงไปที่ Binance · Bybit · OKX · Bitget · Hyperliquid | ล่มเมื่อไรขึ้นแดงทันที |

ทุก endpoint proxy ผ่าน Route Handler ฝั่งเซิร์ฟเวอร์ เพราะ Binance/Yahoo ไม่ส่ง CORS header

## API routes

| Route | ใช้ทำอะไร |
|---|---|
| `/api/quotes?symbols=` | ราคาล่าสุด — แยก Binance/Yahoo อัตโนมัติ |
| `/api/candles?symbol=&tf=` | แท่งเทียน 9 ไทม์เฟรม (5s/15s รวมมาจาก 1s) |
| `/api/context?symbol=` | Funding · OI + การเปลี่ยนแปลง 1 ชม. · แรงซื้อรายใหญ่ · Long/Short — หลักฐานของ Master AI |
| `/api/exchanges` | ping 5 exchange พร้อม latency |
| `/api/microstructure?symbol=` | Order book · trades · funding · OI |
| `/api/movers` · `/api/funding` · `/api/sparks` · `/api/news` · `/api/search` | ตลาดรวม · heatmap · sparkline · ข่าว · ค้นหา |

## ข้อมูลจริง vs. ข้อมูลสาธิต

**คำนวณจากตลาดจริงทั้งหมด:** ราคา · แท่งเทียน · order book · funding · OI · long/short ·
แรงซื้อรายใหญ่ · สถานะ exchange · latency · Market Regime (EMA12/34 + RSI14 + ATR14) ·
Order Block / FVG / Liquidity (คำนวณจากแท่งเทียนจริง) · AI Score ของทุกเหรียญ ·
**การตัดสินใจของ Master AI** (ชั่งหลักฐาน 6 ข้อ ต้องได้ผลต่าง ≥ 2 จึงออกคำสั่ง มิฉะนั้นเป็น WAIT)

**เป็นพอร์ตสาธิต (ติดป้าย `DEMO` บนหน้าจอ):** ขนาดโพซิชัน 5 ไม้ ยอดเงินในกระเป๋า และเลเวอเรจที่ตั้งไว้
เป็นค่าคงที่ใน `src/lib/book.ts` — แต่ราคาเข้า P&L margin ratio และสถิติทั้งหมดคำนวณสดจากราคาจริง
**ไม่มีการเชื่อมต่อบัญชี exchange จริง และไม่ส่งคำสั่งซื้อขายใด ๆ**

รายชื่อ AI 50 ตัวเป็นชุดที่กำหนดไว้ สถานะแต่ละตัวผูกกับสภาพตลาดจริง (ฟีดหลุด = ออฟไลน์ทั้งกอง,
ผันผวนสูง = คิดพร้อมกันมากขึ้น)

## หน้าที่ทำเสร็จแล้ว

ทั้ง 16 หน้าในตารางด้านบนสร้างครบตามสเปกแล้ว เมนูที่เหลือ
(`/history` `/alerts` `/settings`) ยังเป็นโครงหน้าพร้อมรายการสิ่งที่จะทำ

### `/backtest` — Backtesting Center

เครื่องจำลองแยกจาก Strategy Lab (`src/lib/backtest-lab.ts`) เพราะต้องตอบคำถามที่
engine เดิมตอบไม่ได้:

- เปิดได้หลาย Position พร้อมกัน · Funding คิดตามวินาทีที่ถือจริง · Slippage หักทั้งขาเข้าและขาออก
- คำนวณราคา Liquidation จาก Leverage + Margin Mode (Isolated ใช้มาร์จินก้อนเดียว, Cross ใช้ยอดทั้งบัญชีค้ำ)
- ลำดับภายในแท่ง: เติมออเดอร์ที่คิวไว้ที่ราคาเปิด → ตรวจ Liquidation → Stop → Target → Trailing ขยับที่ราคาปิดเท่านั้น
  สัญญาณที่อ่านจากแท่ง `i` เข้าได้เร็วสุดที่ `i+1` จึงไม่มีการมองอนาคต
- จำแนกทุกแท่งเป็น 1 ใน 7 สภาวะตลาดจากราคาและวอลุ่ม เพื่อบอกว่ากลยุทธ์ได้เปรียบตรงไหนจริง ๆ
- สมการต้นทุนตรวจสอบได้: `grossBeforeCosts − totalCosts = netProfit` พอดี
  (บน BTCUSDT 1h กลยุทธ์ตามเทรนด์เปลี่ยนจาก +0.95% เป็น −1.61% เมื่อคิดต้นทุนครบ)
- Paper Trading / Shadow Mode / Production แสดงเป็นด่านที่ล็อกไว้ — แพลตฟอร์มนี้ไม่ส่งคำสั่งจริง

## โครงสร้าง

```text
src/
  app/
    api/            Route Handlers (proxy ทุกแหล่งข้อมูล)
    page.tsx        PAGE 01 Command Center
    layout.tsx      TopBar + Sidebar + SystemFooter + MarketProvider
  components/       แผงทั้งหมด + Logo + viz primitives
  lib/
    agents.ts       AI 50 ตัว 10 pod + เครื่องคำนวณสถานะ
    decision.ts     Master AI + Order Block / FVG / Liquidity / Liquidity Sweep
    analytics.ts    EMA / RSI / ATR / detectRegime
    book.ts         พอร์ตสาธิต + P&L + สถิติ
    market-context.tsx  polling แบบไม่ทับซ้อน + state กลาง
    server/         ตัวเรียก Binance และ Yahoo
```

## ข้อจำกัด

- ราคาหุ้นจาก Yahoo ล่าช้า ~15 นาที และหุ้นไทยไม่ขยับนอกเวลาทำการ SET
- Bybit และ OKX ถูกบล็อกจากบางเครือข่าย — จะขึ้นสถานะแดงตามจริง
- Liquidation Map ประมาณจากความหนาแน่นของ order book (ไม่มี public feed การล้างพอร์ต)
- ไม่ใช่คำแนะนำการลงทุน
