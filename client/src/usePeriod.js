import { useSearchParams } from 'react-router-dom';

// The period on screen lives in the address: ?view=day|week and ?date=YYYY-MM-DD. The default is today, by day.
export default function usePeriod() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'week' ? 'week' : 'day';
  const date = params.get('date') || '';
  const api = { view, ...(date ? { date } : {}) };
  const write = (next) => setParams(next, { replace: false });
  return {
    view,
    date,
    api, // what to send to the server
    query: new URLSearchParams(api).toString(), // for links
    setDate: (d) => write({ view, ...(d ? { date: d } : {}) }),
    setView: (v, d) => write({ view: v, ...(d ? { date: d } : date ? { date } : {}) }),
  };
}
