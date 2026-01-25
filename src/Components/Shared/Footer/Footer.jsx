import React from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaWhatsapp,
} from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-[#f0fdfa] mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* About Section */}
        <div>
          <h2 className="text-xl font-bold mb-4">কাজী গিফট এন্ড প্রিন্ট হাউস</h2>
          <p className=" ">
           উপহার, প্রিন্ট এবং নিত্য-প্রয়োজনের জন্য আপনার নির্ভরযোগ্য গন্তব্য। প্রতিটি উপলক্ষের জন্য অনন্য পণ্য ও মানসম্মত সেবা নিশ্চিত।
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-xl font-bold mb-4">প্রয়োজনীয় লিঙ্ক-সমূহ</h2>
          <ul className="space-y-2  ">
            <li>
              <a href="/" className="hover:text-[#0f766e]">
                হোম
              </a>
            </li>
            <li>
              <a href="/products" className="hover:text-[#0f766e]">
                পন্য-সমূহ
              </a>
            </li>
            <li>
              <a href="/about" className="hover:text-[#0f766e]">
                আমাদের সম্পর্কে
              </a>
            </li>
            <li>
              <a href="/contact" className="hover:text-[#0f766e]">
                যোগাযোগ
              </a>
            </li>
          </ul>
        </div>

        {/* Contact & Social */}
        <div>
          <h2 className="text-xl font-bold mb-4">যোগাযোগের ঠিকানা</h2>
          <p className=" ">📍 ৩/ক, আবু জাফর মার্কেট,কাজী বাড়ী,চট্টগ্রাম,বাংলাদেশ</p>
          <p className=" ">📞 +8801898-050800</p>
          <p className=" ">✉️ kazi.gift.print@gmail.com</p>

          <div className="flex mt-4 space-x-4">
            <a href="https://www.facebook.com/kazigiftandprinthouse" target="_blank" className="hover:text-[#0f766e]">
              <FaFacebookF />
            </a>
            <a href="https://www.facebook.com/kazigiftandprinthouse" target="_blank"  className="hover:text-[#0f766e]">
              <FaInstagram />
            </a>
            <a href="https://www.facebook.com/kazigiftandprinthouse" target="_blank"  className="hover:text-[#0f766e]">
              <FaTwitter />
            </a>
            <a href="http://wa.me/+8801898050800" target="_blank" className="hover:text-[#0f766e]">
              <FaWhatsapp />
            </a>
          </div>
        </div>
      </div>

      <div className=" text-center py-4 mt-6">
        &copy; {new Date().getFullYear()} Kazi Gift & Print House. All rights
        reserved.
      </div>
    </footer>
  );
};

export default Footer;
