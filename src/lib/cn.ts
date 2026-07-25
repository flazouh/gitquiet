import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export const cn = (...inputs: ReadonlyArray<ClassValue>): string => twMerge(clsx(inputs))
