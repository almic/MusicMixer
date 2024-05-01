import Graphics from './lib/graphics/graphics.js';
import { getThemeColors } from './main.js';

/**
 * State holder for drawing the panner visualization
 */
class PanningGraphics {
    #stop = false;
    #audioContext;
    #graphics;

    #pipeline;
    #renderDescriptor;

    constructor(canvas, mixer) {
        this.#audioContext = mixer.context;
        Graphics.createGraphics(canvas).then(async (graphics) => {
            this.#graphics = graphics;
            await this.init();
            this.draw.call(this, 0);
        });
    }

    updatePosition([x, y, z]) {}

    async init() {
        const module = await this.#graphics.loadShader(
            'simple shader',
            'js/lib/graphics/shaders/simple.wgsl',
        );
        this.#pipeline = await this.#graphics.createPipeline('simple pipeline', module, 'vs', 'fs');
        const color = getThemeColors();
        this.#renderDescriptor = this.#graphics.createDescriptor('simple render pass', [
            (color[0] / 255) * 0.04,
            (color[1] / 255) * 0.04,
            (color[2] / 255) * 0.04,
            1,
        ]);
    }

    async draw(time) {
        if (this.#stop) {
            return;
        }

        this.#graphics.updateDescriptor(this.#renderDescriptor);

        const encoder = this.#graphics.startCommandBuffer('simple buffer');
        const pass = encoder.beginRenderPass(this.#renderDescriptor);
        pass.setPipeline(this.#pipeline);
        pass.draw(3);
        pass.end();

        this.#graphics.finishCommandBuffer();
        this.#graphics.submitLastCommandBuffer();

        console.info(this.#graphics.infoDump());

        // requestAnimationFrame(this.draw);
    }

    stop() {
        this.#stop = true;
    }
}

export default PanningGraphics;
