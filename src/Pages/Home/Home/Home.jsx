import React from 'react';
import Banner from '../Banner/Banner';
import FeaturedProduct from '../FeaturedProduct/FeaturedProduct';
import Contactusform from '../Contactusform/Contactusform';

const Home = () => {
    return (
        <>
            <Banner></Banner>
            <FeaturedProduct></FeaturedProduct>
            <Contactusform></Contactusform>
        </>
    );
};

export default Home;