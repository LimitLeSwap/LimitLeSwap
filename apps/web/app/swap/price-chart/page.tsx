import dynamic from "next/dynamic";

export default dynamic(() => import("../priceChart"), {
  ssr: false,
});
