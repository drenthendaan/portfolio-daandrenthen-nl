  import React, { useRef, useEffect } from 'react';

  const PixelHero = () => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const colorHelperRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      let animationFrameId;

      const gridSize = 30; 
      const speed = 150;   
      
      let snake = [
        { x: gridSize * 3, y: gridSize }, 
        { x: gridSize * 2, y: gridSize }, 
        { x: gridSize, y: gridSize }
      ];
      let food = { x: 0, y: 0 };
      let direction = { x: gridSize, y: 0 };
      let nextDirection = { x: gridSize, y: 0 };
      let lastTime = 0;

      const getSassColor = () => {
    if (colorHelperRef.current) {
      const style = window.getComputedStyle(colorHelperRef.current);
      return style.color; 
    }
    return '#22d3ee'; 
  };

      const placeFood = (w, h) => {
        food = {
          x: Math.floor(Math.random() * Math.floor(w / gridSize)) * gridSize,
          y: Math.floor(Math.random() * Math.floor(h / gridSize)) * gridSize
        };
      };

      const update = () => {
        direction = nextDirection;
        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

        if (head.x < 0) head.x = canvas.width - gridSize;
        if (head.x >= canvas.width) head.x = 0;
        if (head.y < 0) head.y = canvas.height - gridSize;
        if (head.y >= canvas.height) head.y = 0;

        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
          placeFood(canvas.width, canvas.height);
        } else {
          if (snake.length > 5) snake.pop();
        }

        const diffX = food.x - head.x;
        const diffY = food.y - head.y;

        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX !== 0) {
            const newDirX = diffX > 0 ? gridSize : -gridSize;
            if (newDirX !== -direction.x) nextDirection = { x: newDirX, y: 0 };
          }
        } else {
          if (diffY !== 0) {
            const newDirY = diffY > 0 ? gridSize : -gridSize;
            if (newDirY !== -direction.y) nextDirection = { x: 0, y: newDirY };
          }
        }
      };

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const color = getSassColor();
        
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(food.x + 6, food.y + 6, gridSize - 12, gridSize - 12);

        ctx.globalAlpha = 1.0;
        snake.forEach((segment, i) => {
          ctx.fillStyle = color;
          ctx.fillRect(segment.x + 1, segment.y + 1, gridSize - 2, gridSize - 2);

          if (i === 0) {
            const eyeSize = 6;      
            const pupilSize = 2;    
            const eyeOffset = 6;    
            const farOffset = 20;   

            const drawEye = (x, y) => {
              ctx.fillStyle = '#FFFFFF'; 
              ctx.fillRect(x, y, eyeSize, eyeSize);
              ctx.fillStyle = '#000000';
              ctx.fillRect(x + (eyeSize - pupilSize) / 2, y + (eyeSize - pupilSize) / 2, pupilSize, pupilSize);
            };

            if (direction.x > 0) { 
              drawEye(segment.x + farOffset, segment.y + eyeOffset);            
              drawEye(segment.x + farOffset, segment.y + gridSize - eyeOffset - eyeSize); 
            } else if (direction.x < 0) { 
              drawEye(segment.x + gridSize - farOffset - eyeSize, segment.y + eyeOffset);
              drawEye(segment.x + gridSize - farOffset - eyeSize, segment.y + gridSize - eyeOffset - eyeSize);
            } else if (direction.y > 0) {
              drawEye(segment.x + eyeOffset, segment.y + farOffset);
              drawEye(segment.x + gridSize - eyeOffset - eyeSize, segment.y + farOffset);
            } else { 
              drawEye(segment.x + eyeOffset, segment.y + gridSize - farOffset - eyeSize);
              drawEye(segment.x + gridSize - eyeOffset - eyeSize, segment.y + gridSize - farOffset - eyeSize);
            }
          }
        });
      };

      const loop = (timestamp) => {
        if (timestamp - lastTime > speed) {
          update();
          draw();
          lastTime = timestamp;
        }
        animationFrameId = window.requestAnimationFrame(loop);
      };

      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          const w = Math.floor(entry.contentRect.width / gridSize) * gridSize;
          const h = Math.floor(entry.contentRect.height / gridSize) * gridSize;
          canvas.width = w > 0 ? w : gridSize;
          canvas.height = h > 0 ? h : gridSize;
          placeFood(canvas.width, canvas.height);
        }
      });

      if (containerRef.current) resizeObserver.observe(containerRef.current);
      animationFrameId = window.requestAnimationFrame(loop);

      return () => {
        window.cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
      };
    }, []);

    return (
      <div className="container hidden md:block">
        <div ref={containerRef} className="speelveld-snake">
          <span ref={colorHelperRef} className="pixel-color-source" style={{ display: 'none' }} />
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
        <hr />
      </div>
    );
  };

  export default PixelHero;