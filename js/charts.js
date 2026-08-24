/**
 * Gráficos Chart.js para el cuadro de honor.
 */
const ChartsHonor = (() => {
  let chartGoleadores = null;

  function destruir() {
    if (chartGoleadores) {
      chartGoleadores.destroy();
      chartGoleadores = null;
    }
  }

  /**
   * Top N goleadores — gráfico de barras horizontal.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label: string, value: number}>} items
   */
  function renderTopGoleadores(canvas, items) {
    if (!canvas || typeof Chart === 'undefined') return;
    destruir();

    const labels = items.map((i) => i.label);
    const values = items.map((i) => i.value);

    chartGoleadores = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Goles',
            data: values,
            backgroundColor: [
              '#D32F2F',
              '#0D1B3E',
              '#E53935',
              '#1A274F',
              '#F9A825',
            ],
            borderRadius: 8,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x} gol${ctx.parsed.x === 1 ? '' : 'es'}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    });
  }

  return { renderTopGoleadores, destruir };
})();
