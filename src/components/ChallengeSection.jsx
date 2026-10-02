function ChallengeSection() {
  const cards = [
    {
      icon: "👁",
      title: "Lack of Visibility",
      desc: "Factories often have no clear view of where their waste goes or how it is processed, leading to compliance and sustainability reporting gaps.",
    },
    {
      icon: "📈",
      title: "No Pricing Clarity",
      desc: "Uncertainty around fair market rates for scrap and by-products makes it difficult to plan and maximize value from waste streams.",
    },
    {
      icon: "🚚",
      title: "Collection Barriers",
      desc: "Logistics and reliable collection remain a hurdle, especially for smaller volumes, delaying recycling and reuse.",
    },
  ];

  return (
    <section id="about" className="section challenge-section">
      <h2 className="section-title">The Challenge Facing African Factories</h2>
      <p className="section-sub">
        African manufacturers face unique barriers when it comes to managing industrial waste responsibly and profitably.
      </p>
      <div className="challenge-cards">
        {cards.map((card, i) => (
          <div key={i} className="challenge-card">
            <div className="challenge-card-icon">{card.icon}</div>
            <h3 className="challenge-card-title">{card.title}</h3>
            <p className="challenge-card-desc">{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ChallengeSection;
