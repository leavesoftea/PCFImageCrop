import * as React from "react";
import ReactCrop from "react-image-crop";

/**
 * Thin wrapper for ReactCrop. We do not override getBox so the crop box outline
 * and selection overlay stay in one coordinate space (displayed media space).
 */
const CropWrapper = (props: React.ComponentProps<typeof ReactCrop>) => {
    return <ReactCrop {...props} />;
};

export default CropWrapper;
