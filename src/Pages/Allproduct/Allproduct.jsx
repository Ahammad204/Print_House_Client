import React, { useState } from "react";

// Sample product data with category and price
const productsData = [
  {
    id: 1,
    name: "Custom Mug",
    stock: 10,
    code: "CGPH-M001",
    category: "Mugs",
    price: 500,
    image:
      "https://images.unsplash.com/photo-1600180758895-f2c3d95aef1b?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 2,
    name: "Greeting Card",
    stock: 0,
    code: "CGPH-G002",
    category: "Cards",
    price: 200,
    image:
      "https://images.unsplash.com/photo-1588776814546-7f322db8d070?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 3,
    name: "Photo Frame",
    stock: 5,
    code: "CGPH-PF003",
    category: "Frames",
    price: 800,
    image:
      "https://images.unsplash.com/photo-1603808033194-7b82fa6e46f6?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 4,
    name: "Notebook",
    stock: 20,
    code: "CGPH-N004",
    category: "Stationery",
    price: 300,
    image:
      "https://images.unsplash.com/photo-1587825140708-4cb1d2c0aee5?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 5,
    name: "Coffee Mug Set",
    stock: 7,
    code: "CGPH-M005",
    category: "Mugs",
    price: 1200,
    image:
      "https://images.unsplash.com/photo-1590080879966-f8c11b59804a?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 6,
    name: "Desk Calendar",
    stock: 15,
    code: "CGPH-D006",
    category: "Stationery",
    price: 450,
    image:
      "https://images.unsplash.com/photo-1597536129058-8d6f38e2c301?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 7,
    name: "Wall Clock",
    stock: 3,
    code: "CGPH-W007",
    category: "Decor",
    price: 1500,
    image:
      "https://images.unsplash.com/photo-1616627567428-7f1a4c6e0ff7?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 8,
    name: "Planner Book",
    stock: 8,
    code: "CGPH-PB008",
    category: "Stationery",
    price: 600,
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 9,
    name: "Photo Album",
    stock: 12,
    code: "CGPH-PA009",
    category: "Frames",
    price: 1000,
    image:
      "https://images.unsplash.com/photo-1616627857297-43e10c7e3a53?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 10,
    name: "Custom Tote Bag",
    stock: 5,
    code: "CGPH-T010",
    category: "Bags",
    price: 700,
    image:
      "https://images.unsplash.com/photo-1593032465171-67b80a4568f1?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 11,
    name: "Greeting Postcard",
    stock: 0,
    code: "CGPH-G011",
    category: "Cards",
    price: 150,
    image:
      "https://images.unsplash.com/photo-1588776814546-7f322db8d070?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 12,
    name: "Ceramic Plate",
    stock: 9,
    code: "CGPH-C012",
    category: "Decor",
    price: 900,
    image:
      "https://images.unsplash.com/photo-1600180758895-f2c3d95aef1b?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 13,
    name: "Desk Lamp",
    stock: 4,
    code: "CGPH-L013",
    category: "Decor",
    price: 2200,
    image:
      "https://images.unsplash.com/photo-1616627428114-3ebd4f3d3bff?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 14,
    name: "Pen Set",
    stock: 25,
    code: "CGPH-P014",
    category: "Stationery",
    price: 350,
    image:
      "https://images.unsplash.com/photo-1587825140708-4cb1d2c0aee5?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 15,
    name: "Desk Organizer",
    stock: 6,
    code: "CGPH-O015",
    category: "Decor",
    price: 800,
    image:
      "https://images.unsplash.com/photo-1603808033194-7b82fa6e46f6?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 16,
    name: "Custom Pillow",
    stock: 7,
    code: "CGPH-P016",
    category: "Decor",
    price: 1200,
    image:
      "https://images.unsplash.com/photo-1616627857297-43e10c7e3a53?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 17,
    name: "Notebook Set",
    stock: 18,
    code: "CGPH-N017",
    category: "Stationery",
    price: 900,
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 18,
    name: "Mug with Lid",
    stock: 2,
    code: "CGPH-M018",
    category: "Mugs",
    price: 600,
    image:
      "https://images.unsplash.com/photo-1590080879966-f8c11b59804a?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 19,
    name: "Desk Calendar 2026",
    stock: 10,
    code: "CGPH-D019",
    category: "Stationery",
    price: 500,
    image:
      "https://images.unsplash.com/photo-1597536129058-8d6f38e2c301?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 20,
    name: "Gift Box",
    stock: 0,
    code: "CGPH-G020",
    category: "Cards",
    price: 300,
    image:
      "https://images.unsplash.com/photo-1588776814546-7f322db8d070?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 21,
    name: "Leather Notebook",
    stock: 5,
    code: "CGPH-N021",
    category: "Stationery",
    price: 1500,
    image:
      "https://images.unsplash.com/photo-1587825140708-4cb1d2c0aee5?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 22,
    name: "Photo Wall Art",
    stock: 6,
    code: "CGPH-F022",
    category: "Frames",
    price: 2500,
    image:
      "https://images.unsplash.com/photo-1603808033194-7b82fa6e46f6?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 23,
    name: "Coffee Coaster Set",
    stock: 12,
    code: "CGPH-C023",
    category: "Mugs",
    price: 700,
    image:
      "https://images.unsplash.com/photo-1600180758895-f2c3d95aef1b?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 24,
    name: "Wall Art Frame",
    stock: 3,
    code: "CGPH-F024",
    category: "Frames",
    price: 1800,
    image:
      "https://images.unsplash.com/photo-1616627428114-3ebd4f3d3bff?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
  {
    id: 25,
    name: "Custom Tote Bag XL",
    stock: 8,
    code: "CGPH-T025",
    category: "Bags",
    price: 1000,
    image:
      "https://images.unsplash.com/photo-1593032465171-67b80a4568f1?crop=entropy&cs=tinysrgb&fit=max&h=300&w=300",
  },
];




const Allproduct = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all"); // all, inStock, outOfStock
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [priceSort, setPriceSort] = useState("none"); // none, lowToHigh, highToLow
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 9;

  const categories = ["all", ...new Set(productsData.map((p) => p.category))];

  // Filter products
  let filteredProducts = productsData.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "inStock" && product.stock > 0) ||
      (stockFilter === "outOfStock" && product.stock === 0);
    const matchesPrice =
      product.price >= priceRange[0] && product.price <= priceRange[1];

    return matchesSearch && matchesCategory && matchesStock && matchesPrice;
  });

  // Sort products
  if (priceSort === "lowToHigh") {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (priceSort === "highToLow") {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  // Pagination logic
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstProduct,
    indexOfLastProduct
  );
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">All Products</h1>

      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        {/* Search */}
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/4 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full md:w-1/6 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "all" ? "All Categories" : cat}
            </option>
          ))}
        </select>

        {/* Stock Filter */}
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="w-full md:w-1/6 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="all">All Stocks</option>
          <option value="inStock">In Stock</option>
          <option value="outOfStock">Out of Stock</option>
        </select>

        {/* Price Range */}
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            value={priceRange[0]}
            onChange={(e) =>
              setPriceRange([Number(e.target.value), priceRange[1]])
            }
            className="w-20 px-2 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <span>-</span>
          <input
            type="number"
            placeholder="Max"
            value={priceRange[1]}
            onChange={(e) =>
              setPriceRange([priceRange[0], Number(e.target.value)])
            }
            className="w-20 px-2 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        {/* Price Sort */}
        <select
          value={priceSort}
          onChange={(e) => setPriceSort(e.target.value)}
          className="w-full md:w-1/6 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="none">Sort By Price</option>
          <option value="lowToHigh">Low to High</option>
          <option value="highToLow">High to Low</option>
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentProducts.length > 0 ? (
          currentProducts.map((product) => (
            <div
              key={product.id}
              className="border cursor-pointer rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow duration-300 bg-white"
            >
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-56 object-cover"
              />
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  {product.name}
                </h2>
                <p className="text-gray-600 mt-1">
                  Product Code: {product.code}
                </p>
                <p className="text-gray-600 mt-1">
                  {product.stock > 0
                    ? `Stock: ${product.stock}`
                    : "Out of Stock"}
                </p>
                <p className="text-gray-700 font-semibold mt-1">
                  ৳ {product.price}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500">
            No products found.
          </p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8 gap-2 flex-wrap">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`px-4 py-2 rounded border ${
                currentPage === num
                  ? "bg-yellow-400 text-white border-yellow-400"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-200"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};





export default Allproduct;
