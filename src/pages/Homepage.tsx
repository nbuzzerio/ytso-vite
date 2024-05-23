import ytsoLogo from "../assets/images/ytso-hero.png";

const Homepage = () => {
  return (
    <div className="flex w-full flex-col justify-center py-10">
      <h1 className="py-2 text-center text-6xl text-white sm:text-7xl lg:py-20">
        Youtube Subscription Organizer
      </h1>
      <img src={ytsoLogo} alt="ytso filing cabinet" className="mx-auto" />
    </div>
  );
};

export default Homepage;
