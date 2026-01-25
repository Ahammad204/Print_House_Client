import React from "react";
import SectionTitle from "../../../Components/Shared/SectionTitle/SectionTitle";

const products = [
  {
    id: 1,
    category: "Gifts",
    title: "Custom Mug Printing",
    price: "$15.99",
    status: "Available",
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  },
  {
    id: 2,
    category: "Printing",
    title: "Business Cards (100 pcs)",
    price: "$25.00",
    status: "Available",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  },
  {
    id: 3,
    category: "Stationery",
    title: "Premium Ballpoint Pen",
    price: "$5.50",
    status: "Available",
    image: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d",
  },
  {
    id: 4,
    category: "Photocopy",
    title: "A4 Photocopy (B&W)",
    price: "$0.10",
    status: "Available",
    image: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d",
  },
];

const FeaturedProduct = () => {
  return (
    <div className="mt-24 mb-10">
      <SectionTitle title="গ্রাহকদের পছন্দের পণ্য" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl shadow-md hover:shadow-lg transition"
          >
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-52 object-cover rounded-t-xl"
            />

            <div className="p-5 space-y-2">
              <p className="text-sm text-gray-500">{product.category}</p>

              <h3 className="text-lg font-semibold text-gray-800">
                {product.title}
              </h3>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[#0f766e] font-bold">
                  {product.price}
                </span>

                <span className="text-xs bg-green-100 text-[#0f766e]
                px-3 py-1 rounded-full">
                  {product.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeaturedProduct;
