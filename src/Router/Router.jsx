import { createBrowserRouter } from "react-router-dom";
import Main from "../Layouts/Main/Main";
import Home from "../Pages/Home/Home/Home";
import Allproduct from "../Pages/Allproduct/Allproduct";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Main></Main>,
    children:[
        {
            path: "/",
            element: <Home></Home>
        },{
          path:"/allproduct",
          element: <Allproduct></Allproduct>
        }
    ]
  },
]);
 