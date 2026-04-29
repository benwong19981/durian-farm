# 榴莲园管理系统

榴莲果园地图管理、施肥记录与肥料效益分析系统。

Durian Orchard Management System — GPS mapping, fertilizer logging, and cost analysis.

---

## 功能模块 / Modules

| 路由 | 模块 | 说明 |
|------|------|------|
| `/map` | 地图管理 | 在地图上绘制地块多边形，记录品种、树龄、棵数 |
| `/fertilizer` | 施肥记录 | 管理肥料产品库，记录每次施肥，实时计算费用 |
| `/compare` | 肥料比较 | 多维度图表分析：费用对比、NPK养分、氮素成本排名 |

---

## 技术栈 / Tech Stack

- **框架**: React 18 + Vite
- **路由**: react-router-dom v6
- **状态管理**: Zustand
- **数据库**: Firebase Firestore
- **认证**: Firebase Auth (Google)
- **地图**: react-leaflet + leaflet-draw + @turf/turf
- **图表**: Recharts
- **样式**: CSS Modules
- **部署**: Vercel

---

## 快速开始 / Quick Start

### 1. 克隆并安装 / Clone & Install

```bash
git clone <your-repo-url>
cd durian-farm
npm install
```

### 2. 配置 Firebase / Configure Firebase

在 [Firebase Console](https://console.firebase.google.com) 中：

1. 创建新项目 / Create a new project
2. 启用 **Authentication → Google** 登录方式
3. 创建 **Firestore Database**（选择 Production 模式）
4. 复制项目配置到 `.env.local`

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Firestore 安全规则 / Security Rules

在 Firebase Console → Firestore → Rules 中粘贴：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 4. 本地开发 / Local Development

```bash
npm run dev
```

### 5. 构建部署 / Build & Deploy

```bash
npm run build
```

部署到 Vercel：将仓库连接到 Vercel，设置环境变量后自动部署。

---

## 数据结构 / Data Model

所有数据存储在 `users/{uid}/` 路径下，实现多用户隔离。

### `users/{uid}/fields` — 地块

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 地块名称 |
| variety | string | 榴莲品种 |
| areaHa | number | 面积（公顷，自动计算） |
| boundary | GeoJSON | 多边形边界 |
| treeCount | number | 树木棵数 |
| treeAge | number | 树龄（年） |

### `users/{uid}/fertilizerProducts` — 肥料产品

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 肥料名称 |
| n / p / k | number | NPK含量 % |
| pricePerKg | number | 每公斤价格 RM |

### `users/{uid}/fertilizerLogs` — 施肥记录

| 字段 | 类型 | 说明 |
|------|------|------|
| fieldId | string | 地块引用 |
| productId | string | 产品引用 |
| quantityKg | number | 用量（公斤） |
| totalCost | number | 总费用 RM |
| date | Timestamp | 施肥日期 |

---

## 注意事项 / Notes

- `.env.local` 已在 `.gitignore` 中，不会提交到版本库
- `vercel.json` 包含 SPA 重写规则，防止页面刷新 404
- 地图默认中心为马来西亚文冬/彭亨地区 `[3.5, 101.9]`
