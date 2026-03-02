import { getState } from '../../state/store.js';
import { icons } from '../icons.js';

export function ReadingStats() {
  const { books, activityLog, settings } = getState();
  const dailyGoal = settings.dailyGoal || 30;

  // -- Status counts --
  const statusCounts = {
    reading: books.filter((b) => b.status === 'reading').length,
    finished: books.filter((b) => b.status === 'finished').length,
    unread: books.filter((b) => b.status === 'unread').length,
    abandoned: books.filter((b) => b.status === 'abandoned').length,
  };
  const total = books.length;

  // -- Avg rating --
  let ratedCount = 0;
  let ratingSum = 0;
  for (const b of books) {
    if (b.rating && b.rating >= 1 && b.rating <= 5) {
      ratedCount++;
      ratingSum += b.rating;
    }
  }
  const avgRating = ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : '\u2013';

  // -- Streaks --
  const streakInfo = { currentStreak: 0, longestStreak: 0, totalDaysRead: 0 };
  let streak = 0;
  const sd = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = sd.toISOString().slice(0, 10);
    const entry = activityLog[dateStr];
    if (entry && entry.minutesRead > 0) {
      streak++;
      if (streak > streakInfo.longestStreak) streakInfo.longestStreak = streak;
    } else {
      if (i === 0) {
        sd.setDate(sd.getDate() - 1);
        continue;
      }
      break;
    }
    sd.setDate(sd.getDate() - 1);
  }
  streakInfo.currentStreak = streak;
  streakInfo.totalDaysRead = Object.values(activityLog).filter(
    (e) => e.minutesRead > 0
  ).length;

  // -- Total reading time --
  let totalMinutes = 0;
  for (const entry of Object.values(activityLog)) {
    totalMinutes += entry.minutesRead || 0;
  }
  const formatTime = (mins) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // -- Last 7 days bar chart --
  const days = [];
  const dayLabels = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(d);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const entry = activityLog[key];
    days.push(entry?.minutesRead || 0);
    dayLabels.push(date.toLocaleDateString('en', { weekday: 'short' }));
  }
  const maxMinutes = Math.max(...days, dailyGoal, 1);
  const weekTotal = days.reduce((a, b) => a + b, 0);

  const barWidth = 30;
  const barGap = 12;
  const chartW = days.length * (barWidth + barGap);
  const chartH = 100;
  const goalY = chartH - (dailyGoal / maxMinutes) * chartH;

  const weeklyBars = days
    .map((val, i) => {
      const h = Math.max(val > 0 ? 2 : 0, (val / maxMinutes) * chartH);
      const x = i * (barWidth + barGap) + barGap / 2;
      const y = chartH - h;
      const color = val >= dailyGoal ? 'var(--accent-green)' : 'var(--primary)';
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" fill="${color}" opacity="0.85" />
        <text x="${x + barWidth / 2}" y="${chartH + 14}" text-anchor="middle"
              font-size="9" font-weight="600" fill="var(--text-muted)" font-family="var(--font-mono)">${dayLabels[i]}</text>
        ${
          val > 0
            ? `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle"
              font-size="8" font-weight="700" fill="var(--text-secondary)" font-family="var(--font-mono)">${val}</text>`
            : ''
        }`;
    })
    .join('');

  const weeklyChart = `
    <svg viewBox="0 0 ${chartW} ${chartH + 20}" class="stats-chart-svg">
      <line x1="0" y1="${goalY}" x2="${chartW}" y2="${goalY}"
            stroke="var(--text-dim)" stroke-width="1" stroke-dasharray="3 3" />
      ${weeklyBars}
    </svg>`;

  // -- Status donut --
  const statusColors = {
    reading: 'var(--primary)',
    finished: 'var(--accent-green)',
    unread: 'var(--text-dim)',
    abandoned: 'var(--error)',
  };
  const statusLabelsMap = {
    reading: 'Reading',
    finished: 'Finished',
    unread: 'Unread',
    abandoned: 'Abandoned',
  };
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const donutSegments = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const pct = total > 0 ? count / total : 0;
      const dash = pct * circumference;
      const seg = `<circle cx="54" cy="54" r="${radius}" fill="none"
        stroke="${statusColors[key]}" stroke-width="14"
        stroke-dasharray="${dash} ${circumference - dash}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 54 54)" />`;
      offset += dash;
      return seg;
    })
    .join('');

  const donutLegend = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(
      ([key, count]) =>
        `<div class="stats-legend-item">
          <span class="stats-legend-dot" style="background:${statusColors[key]}"></span>
          <span>${statusLabelsMap[key]}</span>
          <strong>${count}</strong>
        </div>`
    )
    .join('');

  const donutChart = `
    <svg viewBox="0 0 108 108" class="stats-donut-svg">
      ${donutSegments}
      <text x="54" y="50" text-anchor="middle" font-size="20" font-weight="900" fill="var(--text)" font-family="var(--font-mono)">${total}</text>
      <text x="54" y="66" text-anchor="middle" font-size="8" font-weight="700" fill="var(--text-muted)" font-family="var(--font-mono)" letter-spacing="0.1em">TOTAL</text>
    </svg>`;

  // -- Heatmap (last 91 days = 13 weeks) --
  const heatCellSize = 13;
  const heatGap = 3;
  const heatCols = 13;
  const heatRows = 7;
  const heatW = heatCols * (heatCellSize + heatGap);
  const heatH = heatRows * (heatCellSize + heatGap);

  const heatCells = [];
  const heatStart = new Date();
  heatStart.setDate(heatStart.getDate() - 91 + 1);
  heatStart.setDate(heatStart.getDate() - heatStart.getDay());

  for (let week = 0; week < heatCols; week++) {
    for (let day = 0; day < heatRows; day++) {
      const cellDate = new Date(heatStart);
      cellDate.setDate(cellDate.getDate() + week * 7 + day);
      const key = cellDate.toISOString().slice(0, 10);
      const entry = activityLog[key];
      const mins = entry?.minutesRead || 0;
      const level =
        mins === 0
          ? 0
          : mins < dailyGoal * 0.5
          ? 1
          : mins < dailyGoal
          ? 2
          : mins < dailyGoal * 1.5
          ? 3
          : 4;
      const x = week * (heatCellSize + heatGap);
      const y = day * (heatCellSize + heatGap);
      heatCells.push(
        `<rect x="${x}" y="${y}" width="${heatCellSize}" height="${heatCellSize}" rx="2" class="heatmap-cell heatmap-level-${level}"><title>${key}: ${mins}m</title></rect>`
      );
    }
  }

  const heatmapChart = `
    <svg viewBox="0 0 ${heatW} ${heatH}" class="stats-heatmap-svg">
      ${heatCells.join('')}
    </svg>`;

  // -- KPI data --
  const kpis = [
    { value: `${streakInfo.currentStreak}`, unit: 'd', label: 'Streak' },
    { value: `${statusCounts.finished}`, unit: '', label: 'Finished' },
    { value: avgRating, unit: '\u2605', label: 'Avg Rating' },
    { value: formatTime(totalMinutes), unit: '', label: 'Total Time' },
  ];

  // -- Yearly challenge --
  const yearlyGoal = settings.yearlyGoal || 12;
  const thisYear = String(new Date().getFullYear());
  const finishedThisYear = books.filter(
    (b) => b.status === 'finished' && b.finishDate?.startsWith(thisYear)
  ).length;
  const yearPct = Math.min(
    100,
    Math.round((finishedThisYear / yearlyGoal) * 100)
  );

  return `
    <div class="stats-page">
      <h2>${icons.barChart} Stats</h2>

      <div class="stats-kpi-row">
        ${kpis
          .map(
            (k) => `
          <div class="stats-kpi">
            <div class="stats-kpi-value">${k.value}<span class="stats-kpi-unit">${k.unit}</span></div>
            <div class="stats-kpi-label">${k.label}</div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="stats-grid">
        <div class="stats-panel">
          <h3>This Week <span class="stats-panel-meta">${formatTime(weekTotal)} total</span></h3>
          <div class="stats-chart-container">${weeklyChart}</div>
        </div>

        <div class="stats-panel">
          <h3>Library</h3>
          <div class="stats-donut-container">
            ${donutChart}
            <div class="stats-legend">${donutLegend}</div>
          </div>
        </div>

        <div class="stats-panel stats-panel-wide">
          <h3>Activity <span class="stats-panel-meta">${streakInfo.totalDaysRead} days active</span></h3>
          <div class="stats-heatmap-container">${heatmapChart}</div>
        </div>

        <div class="stats-panel stats-panel-wide">
          <h3>${thisYear} Challenge</h3>
          <div class="challenge-progress">
            <div class="challenge-bar-track">
              <div class="challenge-bar-fill" style="width:${yearPct}%"></div>
            </div>
            <div class="challenge-label">
              <strong>${finishedThisYear}</strong> / ${yearlyGoal} books
              <span class="challenge-pct">${yearPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
