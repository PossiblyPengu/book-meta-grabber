import { getMediaStats, getStreakInfo } from '../../state/selectors.js';

export function StatsCard(mediaType) {
  const stats = getMediaStats(mediaType);
  if (stats.total === 0) return '';

  const formatTime = (mins) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  let items = [
    { label: 'Total', value: stats.total },
    { label: 'Reading', value: stats.reading },
    { label: 'Finished', value: stats.finished },
    { label: 'Unread', value: stats.unread },
  ];

  if (mediaType === 'audiobooks' && stats.totalMinutes > 0) {
    items.push({ label: 'Listen Time', value: formatTime(stats.totalMinutes) });
  }

  if (stats.finishedThisMonth > 0) {
    items.push({ label: 'This Month', value: stats.finishedThisMonth });
  }

  if (stats.finishedThisYear > 0) {
    items.push({ label: 'This Year', value: stats.finishedThisYear });
  }

  const streak = getStreakInfo();
  if (streak.todayMinutes > 0) {
    items.push({
      label: 'Today',
      value: formatTime(streak.todayMinutes),
    });
  }
  if (streak.currentStreak > 0) {
    items.push({
      label: 'Streak',
      value: `${streak.currentStreak}d`,
    });
  }

  return `
    <div class="stats-dashboard">
      ${items
        .map(
          (item) => `
        <div class="stats-dashboard-item">
          <div class="stats-dashboard-value">${item.value}</div>
          <div class="stats-dashboard-label">${item.label}</div>
        </div>`
        )
        .join('')}
    </div>
  `;
}
