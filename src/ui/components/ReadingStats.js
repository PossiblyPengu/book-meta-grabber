import { getState } from '../../state/store.js';
import { icons } from '../icons.js';

export function ReadingStats() {
  const { books, activityLog, settings } = getState();
  const dailyGoal = settings.dailyGoal || 30;

  // â”€â”€ Status pie chart data â”€â”€
  const statusCounts = {
    reading: books.filter((b) => b.status === 'reading').length,
    finished: books.filter((b) => b.status === 'finished').length,
    unread: books.filter((b) => b.status === 'unread').length,
    abandoned: books.filter((b) => b.status === 'abandoned').length,
  };
  const total = books.length;

  // â”€â”€ Last 7 days bar chart â”€â”€
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

  // â”€â”€ Monthly totals (last 6 months) â”€â”€
  const months = [];
  const monthLabels = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const prefix = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, '0')}`;
    let sum = 0;
    for (const [key, val] of Object.entries(activityLog)) {
      if (key.startsWith(prefix)) sum += val.minutesRead || 0;
    }
    months.push(sum);
    monthLabels.push(date.toLocaleDateString('en', { month: 'short' }));
  }
  const maxMonth = Math.max(...months, 1);

  // â”€â”€ Rating distribution â”€â”€
  const ratingDist = [0, 0, 0, 0, 0]; // 1-5 stars
  let ratedCount = 0;
  let ratingSum = 0;
  for (const b of books) {
    if (b.rating && b.rating >= 1 && b.rating <= 5) {
      ratingDist[b.rating - 1]++;
      ratedCount++;
      ratingSum += b.rating;
    }
  }
  const avgRating =
    ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : 'â€”';
  const maxRating = Math.max(...ratingDist, 1);

  // â”€â”€ Genre breakdown â”€â”€
  const genreCounts = {};
  for (const b of books) {
    const g = b.genre || 'Unclassified';
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // â”€â”€ Build SVG charts â”€â”€

  // 1. Weekly bar chart
  const barWidth = 30;
  const barGap = 12;
  const chartW = days.length * (barWidth + barGap);
  const chartH = 120;
  const goalY = chartH - (dailyGoal / maxMinutes) * chartH;

  const weeklyBars = days
    .map((val, i) => {
      const h = (val / maxMinutes) * chartH;
      const x = i * (barWidth + barGap) + barGap / 2;
      const y = chartH - h;
      const color = val >= dailyGoal ? 'var(--accent-green)' : 'var(--primary)';
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${color}" />
        <text x="${x + barWidth / 2}" y="${chartH + 16}" text-anchor="middle" 
              font-size="10" font-weight="700" fill="var(--text-muted)">${
                dayLabels[i]
              }</text>
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" 
              font-size="9" font-weight="700" fill="var(--text-secondary)">${
                val > 0 ? val : ''
              }</text>`;
    })
    .join('');

  const weeklyChart = `
    <svg viewBox="0 0 ${chartW} ${chartH + 24}" class="stats-chart-svg">
      <line x1="0" y1="${goalY}" x2="${chartW}" y2="${goalY}" 
            stroke="var(--accent-orange)" stroke-width="1.5" stroke-dasharray="4 3" />
      ${weeklyBars}
    </svg>`;

  // 2. Status donut
  const statusColors = {
    reading: 'var(--primary)',
    finished: 'var(--accent-green)',
    unread: 'var(--text-dim)',
    abandoned: 'var(--error)',
  };
  const statusLabels = {
    reading: 'Reading',
    finished: 'Finished',
    unread: 'Unread',
    abandoned: 'Abandoned',
  };
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const donutSegments = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const pct = total > 0 ? count / total : 0;
      const dash = pct * circumference;
      const seg = `<circle cx="60" cy="60" r="${radius}" fill="none" 
        stroke="${statusColors[key]}" stroke-width="16"
        stroke-dasharray="${dash} ${circumference - dash}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 60 60)" />`;
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
          <span>${statusLabels[key]}</span>
          <strong>${count}</strong>
        </div>`
    )
    .join('');

  const donutChart = `
    <svg viewBox="0 0 120 120" class="stats-donut-svg">
      ${donutSegments}
      <text x="60" y="56" text-anchor="middle" font-size="22" font-weight="900" fill="var(--text)">${total}</text>
      <text x="60" y="72" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text-muted)">BOOKS</text>
    </svg>`;

  // 3. Monthly bar chart
  const monthBarW = 40;
  const monthGap = 14;
  const monthChartW = months.length * (monthBarW + monthGap);
  const monthBars = months
    .map((val, i) => {
      const h = (val / maxMonth) * chartH;
      const x = i * (monthBarW + monthGap) + monthGap / 2;
      const y = chartH - h;
      return `
        <rect x="${x}" y="${y}" width="${monthBarW}" height="${h}" rx="4" fill="var(--accent-blue)" />
        <text x="${x + monthBarW / 2}" y="${chartH + 16}" text-anchor="middle" 
              font-size="10" font-weight="700" fill="var(--text-muted)">${
                monthLabels[i]
              }</text>
        <text x="${x + monthBarW / 2}" y="${y - 4}" text-anchor="middle" 
              font-size="9" font-weight="700" fill="var(--text-secondary)">${
                val > 0 ? val + 'm' : ''
              }</text>`;
    })
    .join('');

  const monthlyChart = `
    <svg viewBox="0 0 ${monthChartW} ${chartH + 24}" class="stats-chart-svg">
      ${monthBars}
    </svg>`;

  // 4. Rating bars
  const ratingBarW = 200;
  const ratingBarH = 16;
  const ratingBars = ratingDist
    .map((count, i) => {
      const w = (count / maxRating) * ratingBarW;
      const y = i * 28;
      return `
        <text x="0" y="${
          y + 12
        }" font-size="13" font-weight="900" fill="var(--accent-yellow)">${'â˜…'.repeat(
        i + 1
      )}</text>
        <rect x="70" y="${y}" width="${w}" height="${ratingBarH}" rx="3" fill="var(--accent-yellow)" />
        <text x="${72 + w}" y="${
        y + 12
      }" font-size="11" font-weight="700" fill="var(--text-secondary)">${count}</text>`;
    })
    .reverse()
    .join('');

  const ratingChart = `
    <svg viewBox="0 0 ${ratingBarW + 100}" height="${
    5 * 28
  }" class="stats-chart-svg" style="max-width:320px">
      ${ratingBars}
    </svg>`;

  // 5. Top genres
  const genreBars = topGenres
    .map(
      ([name, count]) =>
        `<div class="genre-bar-row">
          <span class="genre-bar-label">${name}</span>
          <div class="genre-bar-track">
            <div class="genre-bar-fill" style="width:${
              (count / (topGenres[0]?.[1] || 1)) * 100
            }%"></div>
          </div>
          <span class="genre-bar-count">${count}</span>
        </div>`
    )
    .join('');

  // ── Streak heatmap (last 91 days = 13 weeks) ──
  const heatmapDays = 91;
  const heatCellSize = 14;
  const heatGap = 3;
  const heatCols = 13;
  const heatRows = 7;
  const heatW = heatCols * (heatCellSize + heatGap);
  const heatH = heatRows * (heatCellSize + heatGap) + 20;

  const heatCells = [];
  const heatStart = new Date();
  heatStart.setDate(heatStart.getDate() - heatmapDays + 1);
  // Align to start of week (Sunday)
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

  // ── Achievements ──
  const streakInfo = {
    currentStreak: 0,
    longestStreak: 0,
    totalDaysRead: 0,
    totalBooksFinished: books.filter((b) => b.status === 'finished').length,
  };

  // Calculate streaks
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

  // Total days with activity
  streakInfo.totalDaysRead = Object.values(activityLog).filter(
    (e) => e.minutesRead > 0
  ).length;

  const achievements = [
    {
      icon: '🔥',
      label: 'Current Streak',
      value: `${streakInfo.currentStreak} days`,
    },
    {
      icon: '🏆',
      label: 'Best Streak',
      value: `${streakInfo.longestStreak} days`,
    },
    {
      icon: '📖',
      label: 'Days Active',
      value: `${streakInfo.totalDaysRead}`,
    },
    {
      icon: '✅',
      label: 'Books Finished',
      value: `${streakInfo.totalBooksFinished}`,
    },
  ];

  const milestones = [
    { threshold: 7, label: '7-Day Streak', icon: '⭐' },
    { threshold: 30, label: '30-Day Streak', icon: '💫' },
    { threshold: 100, label: '100-Day Streak', icon: '🌟' },
    { threshold: 365, label: '365-Day Streak', icon: '👑' },
  ];

  const milestonesHtml = milestones
    .map((m) => {
      const earned = streakInfo.longestStreak >= m.threshold;
      return `<div class="achievement-badge ${earned ? 'earned' : 'locked'}">
        <span class="achievement-icon">${m.icon}</span>
        <span class="achievement-label">${m.label}</span>
      </div>`;
    })
    .join('');

  const achievementsHtml = achievements
    .map(
      (a) =>
        `<div class="achievement-stat">
          <span class="achievement-stat-icon">${a.icon}</span>
          <span class="achievement-stat-value">${a.value}</span>
          <span class="achievement-stat-label">${a.label}</span>
        </div>`
    )
    .join('');

  return `
    <div class="stats-page">
      <h2>${icons.barChart} Reading Stats</h2>

      <div class="stats-grid">
        <div class="stats-panel">
          <h3>This Week</h3>
          <div class="stats-chart-container">${weeklyChart}</div>
          <p class="stats-chart-hint">Dashed line = daily goal (${dailyGoal}m)</p>
        </div>

        <div class="stats-panel">
          <h3>Library Overview</h3>
          <div class="stats-donut-container">
            ${donutChart}
            <div class="stats-legend">${donutLegend}</div>
          </div>
        </div>

        <div class="stats-panel">
          <h3>Monthly Activity</h3>
          <div class="stats-chart-container">${monthlyChart}</div>
        </div>

        <div class="stats-panel">
          <h3>Ratings (avg ${avgRating})</h3>
          <div class="stats-chart-container">${ratingChart}</div>
        </div>

        ${
          topGenres.length > 0
            ? `
        <div class="stats-panel stats-panel-wide">
          <h3>Top Genres</h3>
          <div class="genre-bars">${genreBars}</div>
        </div>`
            : ''
        }

        <div class="stats-panel stats-panel-wide">
          <h3>Reading Heatmap (last 13 weeks)</h3>
          <div class="stats-heatmap-container">${heatmapChart}</div>
        </div>

        <div class="stats-panel">
          <h3>Achievements</h3>
          <div class="stats-achievements">${achievementsHtml}</div>
        </div>

        <div class="stats-panel">
          <h3>Milestones</h3>
          <div class="stats-milestones">${milestonesHtml}</div>
        </div>

        ${renderYearlyChallenge(books, settings)}
      </div>
    </div>
  `;
}

function renderYearlyChallenge(books, settings) {
  const yearlyGoal = settings.yearlyGoal || 12;
  const thisYear = String(new Date().getFullYear());
  const finished = books.filter(
    (b) => b.status === 'finished' && b.finishDate?.startsWith(thisYear)
  ).length;
  const pct = Math.min(100, Math.round((finished / yearlyGoal) * 100));

  return `
    <div class="stats-panel stats-panel-wide">
      <h3>Yearly Challenge ${thisYear}</h3>
      <div class="challenge-progress">
        <div class="challenge-bar-track">
          <div class="challenge-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="challenge-label">
          <strong>${finished}</strong> / ${yearlyGoal} books
          <span class="challenge-pct">(${pct}%)</span>
        </div>
      </div>
    </div>
  `;
}
