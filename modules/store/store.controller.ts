import { Controller, Get, Post, Body, Param, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('products')
  async getProducts(
    @Query('category') category?: string,
    @Query('sport') sport?: string,
  ) {
    return this.storeService.getProducts(category, sport);
  }

  @Get('products/:id')
  async getProductById(@Param('id') id: string) {
    return this.storeService.getProductById(id);
  }

  @Post('products')
  async createProduct(@Body() payload: any) {
    return this.storeService.createProduct(payload);
  }

  @Get('products/:id/slots')
  async getSlots(@Param('id') id: string) {
    return this.storeService.getSlots(id);
  }

  @Post('products/:id/slots/:slotId/lock')
  async lockSlot(
    @Param('id') productId: string,
    @Param('slotId') slotId: string,
    @Body('userId') userId: string,
  ) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.lockSlot(productId, slotId, activeUserId);
  }

  @Post('products/:id/slots/:slotId/unlock')
  async unlockSlot(
    @Param('id') productId: string,
    @Param('slotId') slotId: string,
    @Body('userId') userId: string,
  ) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.unlockSlot(productId, slotId, activeUserId);
  }

  @Get('products/:id/bids')
  async getBids(@Param('id') id: string) {
    return this.storeService.getBids(id);
  }

  @Post('products/:id/bids')
  async placeBid(
    @Param('id') id: string,
    @Body('amountPaise') amountPaise: number,
    @Body('userId') userId: string,
  ) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.placeBid(id, amountPaise, activeUserId);
  }


  @Post('checkout')
  async checkout(
    @Body() checkoutDto: {
      productId: string;
      slotId?: string;
      userId: string;
      paymentMethod: 'upi' | 'gpay' | 'phonepe' | 'paytm' | 'card' | 'wallet';
      pricePaise: number;
      idempotencyKey: string;
    },
  ) {
    const activeUserId = checkoutDto.userId || 'mock-user-123';
    return this.storeService.checkout({
      ...checkoutDto,
      userId: activeUserId,
    });
  }

  @Get('users/:userId/orders')
  async getUserOrders(
    @Param('userId') userId: string,
    @Query('category') category?: string,
  ) {
    const activeUserId = userId || 'abhishekrt959_gmail_com';
    return this.storeService.getUserOrders(activeUserId, category);
  }

  @Get('orders/:orderId/experience')
  async getExperienceOrderById(
    @Param('orderId') orderId: string,
    @Query('userId') userId?: string,
  ) {
    const activeUserId = userId || 'abhishekrt959_gmail_com';
    return this.storeService.getExperienceOrderById(orderId, activeUserId);
  }

  @Get('orders/:orderId/event-pass')
  async getEventPass(
    @Param('orderId') orderId: string,
    @Query('userId') userId?: string,
  ) {
    const activeUserId = userId || 'abhishekrt959_gmail_com';
    return this.storeService.getEventPass(orderId, activeUserId);
  }

  @Get('users/:userId/wallet/balance')
  async getWalletBalance(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    const balance = await this.storeService.getWalletBalance(activeUserId);
    return { balancePaise: balance };
  }

  @Get('users/:userId/wallet/transactions')
  async getWalletTransactions(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.getWalletTransactions(activeUserId);
  }

  @Get('users/:userId/coins/balance')
  async getCoinsBalance(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    const balance = await this.storeService.getCoinsBalance(activeUserId);
    return { balance };
  }

  @Get('users/:userId/coins/transactions')
  async getCoinsTransactions(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.getCoinsTransactions(activeUserId);
  }

  @Post('session-requests')
  async createSessionRequest(@Body() payload: any) {
    return this.storeService.createSessionRequest(payload);
  }

  @Get('users/:userId/session-requests')
  async getSessionRequests(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.getSessionRequests(activeUserId);
  }

  @Get('users/:userId/wishlist')
  async getWishlist(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.getWishlist(activeUserId);
  }

  @Post('users/:userId/wishlist')
  async toggleWishlist(
    @Param('userId') userId: string,
    @Body('productId') productId: string,
    @Body('action') action: 'add' | 'remove',
  ) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.toggleWishlist(activeUserId, productId, action);
  }

  @Get('users/:userId/recently-viewed')
  async getRecentlyViewed(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.getRecentlyViewed(activeUserId);
  }

  @Post('users/:userId/recently-viewed')
  async addRecentlyViewed(
    @Param('userId') userId: string,
    @Body('productId') productId: string,
  ) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.addRecentlyViewed(activeUserId, productId);
  }

  @Get('users/:userId/membership')
  async getUserMembership(@Param('userId') userId: string) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.getUserMembership(activeUserId);
  }

  @Post('users/:userId/membership')
  async updateUserMembership(
    @Param('userId') userId: string,
    @Body('tier') tier: string,
  ) {
    const activeUserId = userId || 'mock-user-123';
    return this.storeService.updateUserMembership(activeUserId, tier);
  }


  @Get('events/checkin/:qrToken')
  async checkInEvent(@Param('qrToken') qrToken: string) {
    const order = await this.storeService.findOrderByQrToken(qrToken);
    if (!order) {
      throw new NotFoundException('Booking order not found for this QR token');
    }

    if (order.status !== 'upcoming') {
      throw new BadRequestException(`Order is not active (current status: ${order.status})`);
    }

    if (order.eventMode !== 'offline') {
      throw new BadRequestException('This check-in link is for offline/in-person events only');
    }

    if (order.checkedIn === true) {
      throw new BadRequestException('Attendee has already checked in for this event');
    }

    await this.storeService.markCheckedIn(order.orderId, order.userId);

    const user = await this.storeService.getUserDetails(order.userId);

    return {
      success: true,
      message: 'Check-in successful!',
      attendee: {
        userId: order.userId,
        firstName: user?.firstName || 'Mock',
        lastName: user?.lastName || 'User',
        email: user?.email || '',
      },
      event: {
        title: order.title,
        eventDate: order.eventDate || '',
        eventMode: order.eventMode,
      },
    };
  }

  @Get('events/join/:joinToken')
  async joinEvent(@Param('joinToken') joinToken: string) {
    const order = await this.storeService.findOrderByJoinToken(joinToken);
    if (!order) {
      throw new NotFoundException('Booking order not found for this join token');
    }

    if (order.status !== 'upcoming') {
      throw new BadRequestException(`Booking is not active (current status: ${order.status})`);
    }

    if (order.eventMode !== 'online') {
      throw new BadRequestException('This join link is for online events only');
    }

    // Expose temporary meeting/live-room URL
    const mockMeetingUrl = `https://zoom.us/j/mock-meeting-${order.orderId.substring(0, 8)}`;
    return {
      success: true,
      meetingUrl: mockMeetingUrl,
      event: {
        title: order.title,
        eventDate: order.eventDate || '',
      },
    };
  }
}
