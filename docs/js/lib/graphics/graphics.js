/**
 *
 */
class Graphics {
    #gpu;
    #gpuAdapter;
    #gpuDevice;
    #gpuQueue;
    #canvasContext;
    #canvasFormat;
    adapterInfo = null;
    deviceLost = null;
    currentEncoder = null;
    lastCommandBuffer = null;
    static async createGraphics(canvas) {
        const gpu = navigator.gpu;
        if (!gpu) {
            throw Error('WebGPU is not supported');
        }
        const gpuCanvasContext = canvas.getContext('webgpu');
        if (!gpuCanvasContext) {
            throw new Error('Failed to get a GPUCanvasContext');
        }
        const adapter = await gpu.requestAdapter({
            powerPreference: 'low-power',
        });
        if (!adapter) {
            throw Error('Failed to request GPUAdapter');
        }
        const device = await adapter.requestDevice({
            label: 'graphicsDevice',
            defaultQueue: { label: 'graphicsQueue' },
        });
        if (!device) {
            throw Error('Failed to request GPUDevice');
        }
        const maxTextureDimension2D = device.limits.maxTextureDimension2D;
        new ResizeObserver((entries) => {
            for (const entry of entries) {
                const canvas = entry.target;
                const { inlineSize: width, blockSize: height } = entry
                    .contentBoxSize[0];
                canvas.width = Math.max(1, Math.min(width, maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, maxTextureDimension2D));
            }
        }).observe(canvas);
        const queue = device.queue;
        return new Graphics(gpu, adapter, device, queue, gpuCanvasContext);
    }
    constructor(gpu, gpuAdapter, gpuDevice, gpuQueue, canvasContext) {
        this.#gpu = gpu;
        this.#gpuAdapter = gpuAdapter;
        this.#gpuDevice = gpuDevice;
        this.#gpuQueue = gpuQueue;
        this.#canvasContext = canvasContext;
        this.#canvasFormat = this.#gpu.getPreferredCanvasFormat();
        this.#canvasContext.configure({
            device: this.#gpuDevice,
            format: this.#canvasFormat,
        });
        this.#gpuAdapter.requestAdapterInfo().then((info) => (this.adapterInfo = info));
        this.#gpuDevice.lost.then((info) => (this.deviceLost = info));
    }
    infoDump() {
        return {
            adapterInfo: {
                vendor: this.adapterInfo?.vendor ?? 'unknown',
                arch: this.adapterInfo?.architecture ?? 'unknown',
                device: this.adapterInfo?.device ?? 'unknown',
                description: this.adapterInfo?.description ?? 'unknown',
            },
            languageFeatures: Array.from(this.#gpu.wgslLanguageFeatures),
            preferredCanvasFormat: this.#canvasFormat,
            adapterFeatures: Array.from(this.#gpuAdapter.features),
            adapterLimits: this.#gpuAdapter.limits,
            deviceFeatures: Array.from(this.#gpuDevice.features),
            deviceLimits: this.#gpuDevice.limits,
            deviceLost: !this.deviceLost
                ? { lost: false }
                : {
                    lost: true,
                    reason: this.deviceLost.reason,
                    message: this.deviceLost.message,
                },
        };
    }
    createDescriptor(label, clearColor = [0, 0, 0, 1], loadOp = 'clear', storeOp = 'store') {
        return {
            label,
            colorAttachments: [
                {
                    clearValue: clearColor,
                    loadOp,
                    storeOp,
                },
            ],
        };
    }
    updateDescriptor(renderDescriptor) {
        const first = renderDescriptor.colorAttachments[0];
        if (first) {
            first.view = this.#canvasContext.getCurrentTexture().createView();
        }
    }
    async loadShader(label, path) {
        const file = await fetch(path);
        const code = await file.text();
        return this.createShader(label, code);
    }
    createShader(label, code) {
        return this.#gpuDevice.createShaderModule({ label, code });
    }
    async createPipeline(label, module, vertexEntry, fragmentEntry) {
        return await this.#gpuDevice.createRenderPipelineAsync({
            label,
            layout: 'auto',
            vertex: {
                module,
                entryPoint: vertexEntry,
            },
            fragment: {
                module,
                entryPoint: fragmentEntry,
                targets: [{ format: this.#canvasFormat }],
            },
        });
    }
    startCommandBuffer(label) {
        if (this.currentEncoder) {
            console.warn(`Overwriting active command encoder! Please call endCommandBuffer() first if this was intentional.`);
        }
        this.currentEncoder = this.#gpuDevice.createCommandEncoder({ label });
        return this.currentEncoder;
    }
    finishCommandBuffer() {
        if (!this.currentEncoder) {
            throw new Error(`The current command buffer is unset, it might have been finished already.`);
        }
        this.lastCommandBuffer = this.currentEncoder.finish();
        this.currentEncoder = null;
        return this.lastCommandBuffer;
    }
    getLastCommandBuffer() {
        if (!this.lastCommandBuffer) {
            throw new Error(`No command buffer has yet been finished.`);
        }
        return this.lastCommandBuffer;
    }
    submitCommandBuffers(buffers) {
        this.#gpuQueue.submit(buffers);
    }
    submitLastCommandBuffer() {
        if (!this.lastCommandBuffer) {
            throw new Error(`No command buffer has yet been finished, unable to submit last command buffer.`);
        }
        this.#gpuQueue.submit([this.lastCommandBuffer]);
    }
}
export default Graphics;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9ncmFwaGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF3QkE7O0dBRUc7QUFDSCxNQUFNLFFBQVE7SUFDRCxJQUFJLENBQU07SUFDVixXQUFXLENBQWE7SUFDeEIsVUFBVSxDQUFZO0lBQ3RCLFNBQVMsQ0FBVztJQUNwQixjQUFjLENBQW1CO0lBQ2pDLGFBQWEsQ0FBbUI7SUFFakMsV0FBVyxHQUEwQixJQUFJLENBQUM7SUFDMUMsVUFBVSxHQUE2QixJQUFJLENBQUM7SUFDNUMsY0FBYyxHQUE2QixJQUFJLENBQUM7SUFDaEQsaUJBQWlCLEdBQTRCLElBQUksQ0FBQztJQUVuRCxNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUF5QjtRQUN4RCxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDO1FBQzFCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNQLE1BQU0sS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sR0FBRyxDQUFDLGNBQWMsQ0FBQztZQUNyQyxlQUFlLEVBQUUsV0FBVztTQUMvQixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDWCxNQUFNLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFDdkMsS0FBSyxFQUFFLGdCQUFnQjtZQUN2QixZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUs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