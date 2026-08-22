import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // Scroll to the top when the pathname changes abruptly.
        // Modern browsers handle Back/Forward appropriately if we use default layout behavior,
        // but React Router's route replacements usually jump. This ensures fresh pages start at the top.
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

export default ScrollToTop;
