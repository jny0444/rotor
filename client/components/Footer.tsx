import Image from "next/image";
import Link from "next/link";
import { TiDocumentText } from "react-icons/ti";

export default function Footer() {
  return (
    <>
      <div className="flex flex-row gap-3 p-3 justify-end">
        <div className="bg-black w-10 h-10 rounded-md flex items-center justify-center">
          <Link href="" target="_blank" rel="noopener noreferrer">
            <TiDocumentText className="w-8 h-8 rounded-md" />
          </Link>
        </div>
        <div className="bg-black w-10 h-10 rounded-md flex items-center justify-center">
          <Link href="" target="_blank" rel="noopener noreferrer">
            <Image
              src="/github.svg"
              alt="GitHub"
              width={1}
              height={1}
              className="w-8 h-8 rounded-md invert"
            />
          </Link>
        </div>
        <div className="bg-black w-10 h-10 rounded-md flex items-center justify-center">
          <Link
            href="https://twitter.com/rotorxyz"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/twitter.svg"
              alt="Twitter"
              width={1}
              height={1}
              className="w-8 h-8 rounded-md"
            />
          </Link>
        </div>
      </div>
    </>
  );
}
