import "./LoadMoreButton.css";

const LoadMoreButton = ({ onClick, loading, hasMore }) => {
    if (!hasMore) return null;

    return (
        <div className="load-more-wrapper">
            <button
                type="button"
                className="load-more-button"
                onClick={onClick}
                disabled={loading}
            >
                {loading ? "Loading more..." : "Load More"}
            </button>
        </div>
    );
};

export default LoadMoreButton;