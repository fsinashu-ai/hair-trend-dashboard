type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <div className="py-6">
      {eyebrow ? (
        <p className="text-sm font-semibold text-teal-700">{eyebrow}</p>
      ) : null}
      <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal text-stone-950 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl break-words text-sm leading-7 text-stone-600 sm:text-base">
        {description}
      </p>
    </div>
  );
}
