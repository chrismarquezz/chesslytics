interface ActivityTrackerProps {
  games: any[];
  gamesLoading: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export default function ActivityTracker({ games, gamesLoading }: ActivityTrackerProps) {
  const lastGame = games?.[0];
  const lastGameDate = lastGame?.end_time ? new Date(lastGame.end_time * 1000) : null;
  const daysSinceLastGame =
    lastGameDate != null ? Math.max(0, Math.floor((Date.now() - lastGameDate.getTime()) / DAY_MS)) : null;
  const modeLabel = lastGame?.time_class ? capitalize(lastGame.time_class) : "—";
  const timeControl = formatTimeControl(lastGame?.time_control);
  const ratedText = lastGame?.rated ? "Rated" : "Casual";

  return (
    <section className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl p-6 border border-gray-200 flex flex-col">
      <h3 className="text-2xl font-semibold text-gray-800 pb-2 border-b border-gray-200 mb-4">
        Activity Tracker
      </h3>

      <div className="flex-1 mt-4 flex flex-col items-center justify-center text-center">
        {gamesLoading ? (
          <p className="text-gray-500 animate-pulse">Checking your recent games...</p>
        ) : lastGameDate ? (
          <div className="flex w-full flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-sm uppercase tracking-wide text-gray-500">Days Since Last Game</p>
              <p className="text-6xl font-extrabold text-[#00bfa6] leading-none">{daysSinceLastGame}</p>
            </div>

            <div className="mt-4 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-gray-500">Last Played</p>
                <p className="text-lg font-semibold text-gray-800">
                  {lastGameDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p className="text-sm text-gray-500">{lastGameDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-gray-500">Format</p>
                <p className="text-lg font-semibold text-gray-800">{modeLabel}</p>
                <p className="text-sm text-gray-500">{ratedText} • {timeControl}</p>
              </div>
            </div>

            {lastGame?.url ? (
              <a
                href={lastGame.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#00bfa6] hover:text-[#00d6b5]"
              >
                View last game →
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-gray-500 text-center">Play a game to start tracking inactivity.</p>
        )}
      </div>
    </section>
  );
}

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimeControl(control?: string) {
  if (!control) return "—";
  const [baseRaw, incRaw] = control.split("+");
  const base = Number(baseRaw);
  if (Number.isNaN(base)) return control;

  const baseLabel = base % 60 === 0 ? `${base / 60}m` : `${base}s`;
  if (incRaw == null) return baseLabel;
  return `${baseLabel}+${incRaw}`;
}
