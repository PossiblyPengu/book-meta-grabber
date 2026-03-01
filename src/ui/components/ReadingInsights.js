import { icons } from '../icons.js';
import { isAudioFormat } from '../../state/selectors.js';

export function ReadingInsights(book, insights) {
  if (!book || !insights) return '';

  const isAudio = isAudioFormat(book.format);
  const hasData = insights.sessionCount > 0;

  if (!hasData) {
    return `
      <div class="detail-section">
        <div class="detail-section-header">
          <span>${icons.trendingUp} Insights</span>
        </div>
        <div class="insights-empty">
          <div class="insights-empty-icon">${icons.clock}</div>
          <div class="insights-empty-text">Start ${
            isAudio ? 'listening' : 'reading'
          } to see insights</div>
          <div class="insights-empty-hint">Log sessions to track your pace and estimated finish time</div>
        </div>
      </div>
    `;
  }

  const cards = [];

  // Total time
  cards.push({
    icon: icons.clock,
    label: `Total ${isAudio ? 'Listen' : 'Read'} Time`,
    value: formatDuration(insights.totalMinutes),
    accent: false,
  });

  // Sessions count
  cards.push({
    icon: icons.calendar,
    label: 'Sessions',
    value: `${insights.sessionCount}`,
    sub: `avg ${formatDuration(insights.avgSessionMinutes)}`,
    accent: false,
  });

  // Pace
  if (insights.pacePerMinute > 0) {
    cards.push({
      icon: icons.trendingUp,
      label: `${isAudio ? 'Listen' : 'Read'} Pace`,
      value: `${insights.pacePerMinute}%/min`,
      accent: false,
    });
  }

  // Time remaining
  if (insights.estimatedRemainingMinutes > 0 && book.progress < 100) {
    cards.push({
      icon: icons.target,
      label: 'Time Remaining',
      value: formatDuration(insights.estimatedRemainingMinutes),
      accent: true,
    });
  }

  // Audio-specific: listened / total
  if (isAudio && insights.totalDurationMinutes > 0) {
    cards.push({
      icon: icons.headphones,
      label: 'Audio Progress',
      value: `${formatDuration(insights.listenedMinutes)} / ${formatDuration(
        insights.totalDurationMinutes
      )}`,
      accent: false,
    });
  }

  // Estimated finish
  if (insights.estimatedFinishDate && book.progress < 100) {
    const date = new Date(insights.estimatedFinishDate);
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    cards.push({
      icon: icons.calendar,
      label: 'Est. Finish',
      value: formatted,
      accent: true,
    });
  }

  // Last session
  if (insights.lastSession) {
    const daysSince = Math.floor(
      (Date.now() -
        new Date(
          insights.lastSession.loggedAt || insights.lastSession.date
        ).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    cards.push({
      icon: icons.bookOpen,
      label: 'Last Session',
      value:
        daysSince === 0
          ? 'Today'
          : daysSince === 1
          ? 'Yesterday'
          : `${daysSince}d ago`,
      sub: `${insights.lastSession.durationMinutes}m`,
      accent: false,
    });
  }

  return `
    <div class="detail-section">
      <div class="detail-section-header">
        <span>${icons.trendingUp} Insights</span>
      </div>
      <div class="insights-grid">
        ${cards
          .map(
            (c) => `
          <div class="insight-card ${c.accent ? 'insight-card-accent' : ''}">
            <div class="insight-card-icon">${c.icon}</div>
            <div class="insight-card-body">
              <div class="insight-card-value">${c.value}</div>
              <div class="insight-card-label">${c.label}</div>
              ${c.sub ? `<div class="insight-card-sub">${c.sub}</div>` : ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
