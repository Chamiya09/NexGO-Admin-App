<div align="center">
  <img src="./assets/images/Admin%20Dark%20App%20Logo.png" width="110" alt="NexGO Admin logo" />

# NexGO Admin

### Monitor the platform, manage operations, and keep the ride network healthy.

[![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?style=for-the-badge&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=111111)](https://reactnative.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)

</div>

## Experience

`NexGO-Admin-App` is the operations console for platform administrators. It brings together analytics, users, drivers, trip activity, live map visibility, promotions, support, reviews, and account security.

## Feature Grid

| Area | Capabilities |
| --- | --- |
| Access | Admin login, session handling, protected requests |
| Dashboard | Analytics and platform overview |
| Users | Passenger listing and account status updates |
| Drivers | Driver listing, document review, account status updates |
| Operations | Trip/activity monitoring and live location visibility |
| Growth | Promotion creation, editing, validation management |
| Trust | Review moderation and support ticket management |
| Account | Admin profile and password management |

## Launch

```bash
npm install
cp .env.example .env
npm start
```

Set `.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:5000/api
```

Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000/api
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Open Expo dev server |
| `npm run android` | Launch Android target |
| `npm run ios` | Launch iOS target |
| `npm run web` | Launch web target |
| `npm run lint` | Run Expo linting |

## App Navigation

| Route | Screen |
| --- | --- |
| `/login` | Admin login |
| `/(tabs)/index` | Dashboard |
| `/(tabs)/users` | Passenger and driver management |
| `/(tabs)/activities` | Trip and activity monitoring |
| `/(tabs)/support` | Support ticket queue |
| `/(tabs)/profile` | Admin profile |
| `/support-ticket/[id]` | Support ticket detail |
| `/profile/admin-details` | Admin details |
| `/profile/account-security` | Password and security |
| `/profile/promotions` | Promotion management |
| `/profile/reviews` | Review moderation |

## Backend Contract

API base:

```text
http://<SERVER_HOST>:5000/api
```

Main backend groups:

`/api/admin`, `/api/auth`, `/api/driver-auth`, `/api/rides`, `/api/promotions`, `/api/reviews`, `/api/support-tickets`.

Admin requests use:

```http
Authorization: Bearer <token>
```

## Device Notes

- Start `NexGO-BackEnd` first.
- Admin-only endpoints require a valid admin token.
- Physical phones need your computer LAN IP, not `localhost`.
- Keep `EXPO_PUBLIC_API_URL` ending with `/api`.
- Location permission supports map and location-aware monitoring features.

