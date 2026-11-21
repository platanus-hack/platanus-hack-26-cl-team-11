import React from "react";
import "./calendar-study.css";

const times = ["10:00", "10:30", "11:00"];
const schedules = [
  {person:"Ian", entries:["Diseño", null, null], color:"violet"},
  {person:"Lian", entries:[null, null, "Taller"], color:"amber"},
];

export async function calendarTimeline(act) {
  act.mark("comparar");
  await act.wait(2650);
  act.mark("coincidir");
  await act.wait(710);
  act.mark("proponer");
  await act.wait(4440);
}

function Schedule({person, entries, color}) {
  return <div className="cal-row">
    <div className="cal-person"><img src={window.rondaFaces[person.toLowerCase()]} alt=""/><b>{person}</b></div>
    {entries.map((entry, i) => <div key={times[i]} className={'cal-well '+(i===1?'cal-match':'')}>
      <span className={'cal-key '+(entry?'busy '+color:'free')}>
        {entry || 'Libre'}
      </span>
    </div>)}
  </div>;
}

export default function CalendarStudy({paused, poster}) {
  return <div className="cal-scene" data-paused={paused} data-poster={poster}>
    <section className="cal-console">
      <header className="cal-head">
        <div><div className="cal-date">Viernes, 20 de noviembre</div><h1>Cruce de agendas</h1></div>
        <span className="cal-duration">30 min</span>
      </header>
      <div className="cal-bed">
        <div className="cal-scale">
          <div className="cal-carriage" aria-hidden="true"><i/></div>
          {times.map(time=><b key={time}>{time}</b>)}
        </div>
        {schedules.map(s=><Schedule key={s.person} {...s}/>)}
      </div>
      <div className="cal-outlet" aria-hidden="true"><i/></div>
    </section>
    <div className="cal-delivery">
      <div className="cal-slip">
        <div><span>Horario propuesto</span><strong>10:30 – 11:00</strong></div>
        <div className="cal-stub"><i aria-hidden="true">✓</i><b>Ambos libres</b></div>
      </div>
    </div>
  </div>;
}
