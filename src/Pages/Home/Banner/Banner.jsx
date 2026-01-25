import React from 'react';
import banner from "../../../assets/banner.jpg";

const Banner = () => {
    return (
        <div className="w-full">
            <img
                src={banner}
                alt="Banner"
                className="w-full mt-10 h-auto block"
            />
        </div>
    );
};

export default Banner;
