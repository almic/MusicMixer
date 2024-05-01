type GPUInfoDump = {
    adapterInfo: {
        vendor: string;
        arch: string;
        device: string;
        description: string;
    };
    languageFeatures: WGSLLanguageFeatures | string[];
    preferredCanvasFormat: GPUTextureFormat;
    adapterFeatures: GPUSupportedFeatures | string[];
    adapterLimits: GPUSupportedLimits;
    deviceFeatures: GPUSupportedFeatures | string[];
    deviceLimits: GPUSupportedLimits;
    deviceLost: {
        lost: boolean;
        reason?: GPUDeviceLostReason;
        message?: string;
    };
};

type GPURenderPassDescriptorOptionalView = Omit<GPURenderPassDescriptor, 'colorAttachments'> & {
    colorAttachments: (Omit<GPURenderPassColorAttachment, 'view'> & { view?: GPUTextureView })[];
};

/**
 *
 */
class Graphics {
    readonly #gpu: GPU;
    readonly #gpuAdapter: GPUAdapter;
    readonly #gpuDevice: GPUDevice;
    readonly #gpuQueue: GPUQueue;
    readonly #canvasContext: GPUCanvasContext;
    readonly #canvasFormat: GPUTextureFormat;

    private adapterInfo: GPUAdapterInfo | null = null;
    private deviceLost: GPUDeviceLostInfo | null = null;
    private currentEncoder: GPUCommandEncoder | null = null;
    private lastCommandBuffer: GPUCommandBuffer | null = null;

    public static async createGraphics(canvas: HTMLCanvasElement) {
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
                const canvas = entry.target as HTMLCanvasElement;
                const { inlineSize: width, blockSize: height } = entry
                    .contentBoxSize[0] as ResizeObserverSize;
                canvas.width = Math.max(1, Math.min(width, maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, maxTextureDimension2D));
            }
        }).observe(canvas);

        const queue = device.queue;
        return new Graphics(gpu, adapter, device, queue, gpuCanvasContext);
    }

    constructor(
        gpu: GPU,
        gpuAdapter: GPUAdapter,
        gpuDevice: GPUDevice,
        gpuQueue: GPUQueue,
        canvasContext: GPUCanvasContext,
    ) {
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

    public infoDump(): GPUInfoDump {
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

    public createDescriptor(
        label: string,
        clearColor: GPUColor = [0, 0, 0, 1],
        loadOp: GPULoadOp = 'clear',
        storeOp: GPUStoreOp = 'store',
    ): GPURenderPassDescriptorOptionalView {
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

    public updateDescriptor(renderDescriptor: GPURenderPassDescriptorOptionalView): void {
        const first = renderDescriptor.colorAttachments[0];
        if (first) {
            first.view = this.#canvasContext.getCurrentTexture().createView();
        }
    }

    public async loadShader(label: string, path: string): Promise<GPUShaderModule> {
        const file = await fetch(path);
        const code = await file.text();
        return this.createShader(label, code);
    }

    public createShader(label: string, code: string): GPUShaderModule {
        return this.#gpuDevice.createShaderModule({ label, code });
    }

    public async createPipeline(
        label: string,
        module: GPUShaderModule,
        vertexEntry: string,
        fragmentEntry: string,
    ): Promise<GPURenderPipeline> {
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

    public startCommandBuffer(label: string): GPUCommandEncoder {
        if (this.currentEncoder) {
            console.warn(
                `Overwriting active command encoder! Please call endCommandBuffer() first if this was intentional.`,
            );
        }
        this.currentEncoder = this.#gpuDevice.createCommandEncoder({ label });
        return this.currentEncoder;
    }

    public finishCommandBuffer(): GPUCommandBuffer {
        if (!this.currentEncoder) {
            throw new Error(`The current command buffer is unset, it might have been finished already.`);
        }
        this.lastCommandBuffer = this.currentEncoder.finish();
        this.currentEncoder = null;
        return this.lastCommandBuffer;
    }

    public getLastCommandBuffer(): GPUCommandBuffer {
        if (!this.lastCommandBuffer) {
            throw new Error(`No command buffer has yet been finished.`);
        }
        return this.lastCommandBuffer;
    }

    public submitCommandBuffers(buffers: GPUCommandBuffer[]): void {
        this.#gpuQueue.submit(buffers);
    }

    public submitLastCommandBuffer(): void {
        if (!this.lastCommandBuffer) {
            throw new Error(`No command buffer has yet been finished, unable to submit last command buffer.`);
        }
        this.#gpuQueue.submit([this.lastCommandBuffer]);
    }
}

export default Graphics;
