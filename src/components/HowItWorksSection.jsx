function HowItWorksSection() {
  const steps = [
    { icon: "P", title: "List Waste", desc: "Register your factory and list the types and volumes of waste or by-products you generate." },
    { icon: "🌿", title: "Get Matched", desc: "Our platform connects you with verified buyers looking for your specific materials." },
    { icon: "🔄", title: "Verified Buyers", desc: "Deal only with vetted buyers who meet our environmental and compliance standards." },
    { icon: "📊", title: "Earn Revenue", desc: "Turn waste into income while improving your sustainability footprint and reporting." },
  ];

  return (
    <section className="section how-section">
      <h2 className="section-title">How EcoLoop Works</h2>
      <p className="section-sub">Your steps to sustainable industrial waste management</p>
      <div className="how-steps">
        {steps.map((step, i) => (
          <div key={i} className="how-step">
            <div className="how-step-icon">{step.icon}</div>
            <h3 className="how-step-title">{step.title}</h3>
            <p className="how-step-desc">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default HowItWorksSection;
