import dynamic from "next/dynamic";

export default dynamic(() => import("./dynamicTest"), {
  ssr: false,
});
