import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900">iSchool</h1>
      <p className="max-w-md text-gray-600">
        The all-in-one platform for schools and colleges — attendance, results, fees,
        communication, and live online classes, white-labeled for every school on board.
      </p>
      <Link href="/login" className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
        Sign in
      </Link>
    </div>
  );
}
