"use client";

import Link from "next/link";
import { MouseEventHandler, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
  active?: boolean;
  breathe?: boolean;
};

type LinkModeProps = BaseProps & {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
};

type ButtonModeProps = BaseProps & {
  href?: never;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

type BwNavButtonProps = LinkModeProps | ButtonModeProps;

export function BwNavButton(props: BwNavButtonProps) {
  const { children, className, active = false, breathe = true } = props;
  const classes = [
    "bw-navbtn",
    "bw-navbtn-hover",
    breathe ? "bw-breathe" : "",
    active ? "is-active" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const href = (props as LinkModeProps).href;
  if (typeof href === "string") {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={props.type ?? "button"} onClick={props.onClick} disabled={props.disabled}>
      {children}
    </button>
  );
}
