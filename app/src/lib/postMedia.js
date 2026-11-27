/** Leave room for the pixel rounding that happens when a 3:4 crop is exported. */
export function needsSquarePostFrame(width, height) {
  return width > 0 && height > 0 && width + 1 < height * 3 / 4
}
