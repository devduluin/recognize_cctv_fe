// Synthetic, read-only API responses. Never connect documentation captures to a database.
const workspace = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const permissions = {
  'events.read': 'Lihat event dan statistik pengunjung', 'events.write': 'Tambah dan ubah event',
  'events.delete': 'Hapus event dan reset data event', 'monitoring.control': 'Mulai, jeda, dan hentikan monitoring',
  'cameras.read': 'Lihat kamera dan konfigurasi sumber kamera', 'cameras.write': 'Tambah, ubah, dan hapus kamera',
  'reports.read': 'Lihat dan unduh laporan', 'visitors.correct': 'Review, gabung, dan koreksi pengunjung',
  'videos.analyze': 'Upload dan analisis video', 'recordings.read': 'Lihat dan unduh rekaman',
  'recordings.delete': 'Hapus rekaman workspace', 'settings.write': 'Ubah pengaturan sistem dan dashboard',
  'sync.run': 'Sinkronisasi seluruh data workspace (baca, ubah, dan hapus)', 'users.manage': 'Tambah pengguna dan kelola izin pengguna',
};
const user = { id: workspace, workspace_id: workspace, company_id: null, account_type: 'personal',
  full_name: 'Admin Contoh', email: 'admin@example.test', role: 'admin', permissions: Object.keys(permissions),
  custom_permissions: null, is_active: true, version: 'documentation-1' };
const cameraId = '33333333-3333-4333-8333-333333333333';
function fixture(url, method = 'GET') {
  if (method !== 'GET') return undefined;
  const path = url.pathname;
  const result = value => ({ result: value });
  if (path === '/api/v1/auth/me') return result({ user });
  if (path === '/api/v1/auth/dashboard-profile') return result({ profile: { name: 'Visitor Counter · Contoh', logo: '' } });
  if (path === '/api/v1/events') return result([{ id: eventId, name: 'Pameran Contoh', location: 'Aula Utama',
    event_date: '2026-10-16', event_end_date: '2026-10-16', event_start: '08:00', event_end: '17:00',
    auto_run: false, capacity: 500, camera_ids: [cameraId], camera_settings: {}, gender_enabled: true,
    status: 'stopped', visitor_count: 120, created_at: '2026-10-16T00:00:00Z' }]);
  if (path === '/api/v1/cctv/camera-previews') return result([{ id: cameraId, name: 'Pintu Utama (contoh)',
    has_source: true, status: 'offline', events: ['Pameran Contoh'] }]);
  if (path === `/api/v1/cctv/cameras/${workspace}`) return result([{ id: cameraId, name: 'Pintu Utama (contoh)',
    rtsp_url: 'rtsp://192.0.2.10/stream', camera_source: 'rtsp://192.0.2.10/stream', status: 'offline', events: [] }]);
  if (path === `/api/v1/cctv/settings/${workspace}`) return result({ enabled: true, timezone: 'Asia/Jakarta' });
  if (path === '/api/v1/users') return result({ users: [user, { ...user, id: eventId, role: 'viewer',
    full_name: 'Pembaca Laporan', email: 'viewer@example.test', permissions: ['events.read', 'reports.read', 'recordings.read'] }], total: 2 });
  if (path === '/api/v1/users/permissions') return result({ permissions: Object.entries(permissions).map(([key, label]) => ({ key, label })),
    roles: { admin: Object.keys(permissions), operator: ['events.read', 'events.write', 'monitoring.control', 'cameras.read', 'reports.read', 'visitors.correct', 'videos.analyze', 'recordings.read'],
      viewer: ['events.read', 'reports.read', 'recordings.read'] } });
  if (path === '/api/v1/event_visitor/statistics/hourly') {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${String(hour).padStart(2, '0')}:00`,
      in_count: hour >= 8 && hour < 18 ? 12 : 0, male_count: hour >= 8 && hour < 18 ? 5 : 0,
      female_count: hour >= 8 && hour < 18 ? 5 : 0, unknown_count: hour >= 8 && hour < 18 ? 2 : 0 }));
    return result({ date: url.searchParams.get('date'), timezone: 'Asia/Jakarta', total_in: 120, male_count: 50,
      female_count: 50, unknown_gender_count: 20, peak_hour: hours[8], hours });
  }
  if (path === '/api/v1/sync/status') return { connected: true, server: 'https://api.example.com', auto_sync: true,
    interval_seconds: 300, connection_state: 'online', last_success: '2026-10-16T09:00:00Z', complete: true,
    conflicts: [], counts: { uploaded: 12, downloaded: 8, conflicts: 0, deferred: 0 },
    history: [{ id: 'sample-1', started_at: '2026-10-16T08:59:58Z', finished_at: '2026-10-16T09:00:00Z',
      trigger: 'manual', outcome: 'complete', counts: { uploaded: 12, downloaded: 8, conflicts: 0, deferred: 0 } }] };
  return undefined;
}
module.exports = { fixture, user };
