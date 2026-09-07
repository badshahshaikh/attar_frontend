import './PageLoader.css';

const PageLoader = () => {
  return (
    <div className="page-loader">
      <div className="loader-content">
        <div className="loader-spinner"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
};

export default PageLoader;