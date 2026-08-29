type Props = {
  imagePath: string;
  alt?: string;
  className?: string;
};

export default function DishImage({ imagePath, alt, className }: Props) {
  if (!imagePath) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imagePath} alt={alt ?? ""} className={className} />;
}
