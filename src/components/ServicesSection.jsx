import eWasteImg from "../assets/services/battery-waste.png";
import wasteCollectionImg from "../assets/services/waste-management.png";
import recyclingProgramsImg from "../assets/services/e-waste.png";
import tyreWasteImg from "../assets/services/tyre-waste.png";
import wasteMarketImg from "../assets/services/recycler-registration.png";
import plasticWasteImg from "../assets/services/plastic-waste.png";

const services = [
  {
    title: "E-Waste Recycling",
    desc: "Secure disposal and recycling of electronic waste, ensuring data security and environmental compliance.",
    img: eWasteImg,
  },
  {
    title: "Waste Collection",
    desc: "Reliable and efficient waste collection services tailored to your schedule and volume.",
    img: wasteCollectionImg,
  },
  {
    title: "Recycling Programs",
    desc: "Customized recycling solutions for various waste streams, including plastics, paper, and glass.",
    img: recyclingProgramsImg,
  },
  {
    title: "Tyre Waste Upcycling",
    desc: "Innovative solutions for converting discarded tires into valuable products.",
    img: tyreWasteImg,
  },
  {
    title: "Waste Market Access",
    desc: "Connect your business to a broad network of verified buyers and sellers for various waste materials.",
    img: wasteMarketImg,
  },
  {
    title: "Plastic Waste Solutions",
    desc: "Comprehensive strategies for managing and recycling plastic waste effectively.",
    img: plasticWasteImg,
  },
];

function ServicesSection() {
  return (
    <section id="services" className="section services-section">
      <h2 className="section-title">Our Services</h2>
      <p className="section-sub">
        Comprehensive waste solutions designed to meet the unique needs of industrial clients. We offer a range of services tailored to optimize waste recovery and resource utilization.
      </p>
      <div className="services-grid">
        {services.map((s, i) => (
          <div key={i} className="service-card">
            <div className="service-card-image">
              <img src={s.img} alt={s.title} />
            </div>
            <div className="service-card-body">
              <h3 className="service-card-title">{s.title}</h3>
              <p className="service-card-desc">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ServicesSection;
