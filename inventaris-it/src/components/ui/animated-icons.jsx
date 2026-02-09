import * as React from "react";
import { motion, useAnimation } from "framer-motion";

/**
 * Animated SendHorizontal icon based on animate-ui.com
 * 
 * Usage:
 *   <AnimatedSendHorizontal size={18} animateOnHover />
 *   
 * Inside a button, use `animate` prop controlled by parent hover:
 *   <AnimatedSendHorizontal size={18} animate={isHovered} />
 * 
 * Or use CSS group-hover by wrapping parent with `group` class:
 *   <button className="group">
 *     <AnimatedSendHorizontal size={18} animateOnGroupHover />
 *   </button>
 */
function AnimatedSendHorizontal({ 
  size = 24, 
  className, 
  animateOnHover = false, 
  animateOnGroupHover = false,
  animate: animateProp,
  loop = false,
  loopDelay = 800,
  ...props 
}) {
  const controls = useAnimation();
  const [selfHovered, setSelfHovered] = React.useState(false);
  const [groupHovered, setGroupHovered] = React.useState(false);
  const spanRef = React.useRef(null);
  const loopRef = React.useRef(true);

  // Detect parent group hover via DOM
  React.useEffect(() => {
    if (!animateOnGroupHover || !spanRef.current) return;
    
    const group = spanRef.current.closest(".group");
    if (!group) return;

    const enter = () => setGroupHovered(true);
    const leave = () => setGroupHovered(false);
    group.addEventListener("mouseenter", enter);
    group.addEventListener("mouseleave", leave);
    return () => {
      group.removeEventListener("mouseenter", enter);
      group.removeEventListener("mouseleave", leave);
    };
  }, [animateOnGroupHover]);

  // Loop animation
  React.useEffect(() => {
    if (!loop) return;
    loopRef.current = true;

    const runLoop = async () => {
      while (loopRef.current) {
        await controls.start("animate");
        await new Promise((r) => setTimeout(r, loopDelay));
      }
    };
    runLoop();

    return () => { loopRef.current = false; };
  }, [loop, loopDelay, controls]);

  const isActive = animateProp ?? (animateOnGroupHover ? groupHovered : selfHovered);

  React.useEffect(() => {
    if (loop) return;
    if (isActive) {
      controls.start("animate");
    } else {
      controls.start("initial");
    }
  }, [isActive, controls, loop]);

  const groupVariants = {
    initial: {
      scale: 1,
      x: 0,
    },
    animate: {
      scale: [1, 0.8, 1, 1, 1],
      x: ["0%", "-10%", "125%", "-150%", "0%"],
      transition: {
        default: { ease: "easeInOut", duration: 1.2 },
        x: {
          ease: "easeInOut",
          duration: 1.2,
          times: [0, 0.25, 0.5, 0.5, 1],
        },
      },
    },
  };

  return (
    <span
      ref={spanRef}
      className={className}
      style={{ display: "inline-flex", overflow: "hidden" }}
      onMouseEnter={animateOnHover ? () => setSelfHovered(true) : undefined}
      onMouseLeave={animateOnHover ? () => setSelfHovered(false) : undefined}
      {...props}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={groupVariants}
        animate={controls}
      >
        <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.629a.498.498 0 0 0 .682.627l18.168-8.215a.5.5 0 0 0 0-.904z" />
        <path d="M6 12h16" />
      </motion.svg>
    </span>
  );
}

/**
 * Animated ChartLine icon based on animate-ui.com (Lucide chart-line)
 *
 * The chart line draws itself in on animate, retracts on reset.
 */
function AnimatedChartLine({
  size = 24,
  className,
  animateOnHover = false,
  animateOnView = false,
  animate: animateProp,
  loop = false,
  loopDelay = 800,
  ...props
}) {
  const controls = useAnimation();
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef(null);
  const loopRef = React.useRef(true);

  // Animate on view (IntersectionObserver)
  React.useEffect(() => {
    if (!animateOnView || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) controls.start("animate"); },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animateOnView, controls]);

  // Loop animation
  React.useEffect(() => {
    if (!loop) return;
    loopRef.current = true;

    const runLoop = async () => {
      while (loopRef.current) {
        await controls.start("animate");
        await new Promise((r) => setTimeout(r, loopDelay));
        await controls.start("initial");
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    runLoop();

    return () => { loopRef.current = false; };
  }, [loop, loopDelay, controls]);

  const isActive = animateProp ?? hovered;

  React.useEffect(() => {
    if (animateOnView || loop) return;
    controls.start(isActive ? "animate" : "initial");
  }, [isActive, controls, animateOnView, loop]);

  const axisVariants = {
    initial: { pathLength: 1, opacity: 0.7 },
    animate: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 0.3 },
    },
  };

  const lineVariants = {
    initial: { pathLength: 0, opacity: 0 },
    animate: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 0.6, delay: 0.15, ease: "easeOut" },
    },
  };

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-flex" }}
      onMouseEnter={animateOnHover ? () => setHovered(true) : undefined}
      onMouseLeave={animateOnHover ? () => setHovered(false) : undefined}
      {...props}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={controls}
        initial="initial"
      >
        <motion.path d="M3 3v16a2 2 0 0 0 2 2h16" variants={axisVariants} />
        <motion.path d="m19 9-5 5-4-4-3 3" variants={lineVariants} />
      </motion.svg>
    </span>
  );
}

/**
 * Animated BadgeCheck icon based on animate-ui.com (Lucide badge-check)
 *
 * The checkmark draws in on animate; badge scales subtly.
 */
function AnimatedBadgeCheck({
  size = 24,
  className,
  animateOnHover = false,
  animateOnView = false,
  animate: animateProp,
  loop = false,
  loopDelay = 800,
  ...props
}) {
  const controls = useAnimation();
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef(null);
  const loopRef = React.useRef(true);

  React.useEffect(() => {
    if (!animateOnView || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) controls.start("animate"); },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animateOnView, controls]);

  React.useEffect(() => {
    if (!loop) return;
    loopRef.current = true;
    const runLoop = async () => {
      while (loopRef.current) {
        await controls.start("animate");
        await new Promise((r) => setTimeout(r, loopDelay));
        await controls.start("initial");
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    runLoop();
    return () => { loopRef.current = false; };
  }, [loop, loopDelay, controls]);

  const isActive = animateProp ?? hovered;

  React.useEffect(() => {
    if (animateOnView || loop) return;
    controls.start(isActive ? "animate" : "initial");
  }, [isActive, controls, animateOnView, loop]);

  const badgeVariants = {
    initial: { scale: 1, opacity: 0.8 },
    animate: {
      scale: [1, 1.1, 1],
      opacity: 1,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  const checkVariants = {
    initial: { pathLength: 0, opacity: 0 },
    animate: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 0.4, delay: 0.2, ease: "easeOut" },
    },
  };

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-flex" }}
      onMouseEnter={animateOnHover ? () => setHovered(true) : undefined}
      onMouseLeave={animateOnHover ? () => setHovered(false) : undefined}
      {...props}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={badgeVariants}
        animate={controls}
        initial="initial"
      >
        <motion.path
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        />
        <motion.path d="m9 12 2 2 4-4" variants={checkVariants} />
      </motion.svg>
    </span>
  );
}

export { AnimatedSendHorizontal, AnimatedChartLine, AnimatedBadgeCheck };
