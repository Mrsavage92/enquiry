/**
 * The phone captures of the sample workspace ship at 390px and 780px wide, so
 * a 2x screen gets real pixels instead of an upscaled 390px image.
 */
export function mobileCaptureSrcSet(id: string): string {
  return `/product/ui1/${id}-mobile.jpg 1x, /product/ui1/${id}-mobile@2x.jpg 2x`;
}
