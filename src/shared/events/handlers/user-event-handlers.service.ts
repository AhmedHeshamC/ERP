import { Injectable, Logger } from '@nestjs/common';
import { IDomainEvent } from '../types/event.types';
import { UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent } from '../types/domain-events.types';

/**
 * User Event Handlers Service
 * Handles user-related domain events with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles user events only
 * - Open/Closed: Extensible through new event handlers
 * - Interface Segregation: Focused on user event operations
 * - Dependency Inversion: Depends on abstractions for user operations
 */
@Injectable()
export class UserEventHandlersService {
  private readonly logger = new Logger(UserEventHandlersService.name);

  /**
   * Handle User Created Event
   * Performs actions when a new user is created
   */
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    this.logger.debug(`Handling UserCreated event for user: ${event.aggregateId}`);

    try {
      // Extract user data from event metadata
      const { email, firstName, lastName, role } = event.metadata;

      // Business logic for user creation:
      // 1. Send welcome email
      await this.sendWelcomeEmail(email, firstName, lastName);

      // 2. Create user profile in external systems
      await this.createUserProfile(event.aggregateId, email, firstName, lastName, role);

      // 3. Set up user preferences
      await this.initializeUserPreferences(event.aggregateId);

      // 4. Log user creation for analytics
      await this.logUserCreation(event);

      // 5. Create initial audit log
      await this.createAuditLog('USER_CREATED', event.aggregateId, {
        email,
        firstName,
        lastName,
        role
      });

      this.logger.log(`Successfully processed UserCreated event for user: ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to process UserCreated event for user ${event.aggregateId}:`, error);
      throw error;
    }
  }

  /**
   * Handle User Updated Event
   * Performs actions when a user is updated
   */
  async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    this.logger.debug(`Handling UserUpdated event for user: ${event.aggregateId}`);

    try {
      const { changes } = event.metadata;

      // Business logic for user updates:
      // 1. Update external systems if needed
      if (changes.email) {
        await this.updateEmailInExternalSystems(event.aggregateId, changes.email);
      }

      // 2. Update user roles if changed
      if (changes.role) {
        await this.updateUserRoleInExternalSystems(event.aggregateId, changes.role);
      }

      // 3. Log profile changes for audit
      await this.createAuditLog('USER_UPDATED', event.aggregateId, changes);

      // 4. Notify relevant systems about changes
      await this.notifyUserChanges(event.aggregateId, changes);

      this.logger.log(`Successfully processed UserUpdated event for user: ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to process UserUpdated event for user ${event.aggregateId}:`, error);
      throw error;
    }
  }

  /**
   * Handle User Deleted Event
   * Performs cleanup when a user is deleted
   */
  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    this.logger.debug(`Handling UserDeleted event for user: ${event.aggregateId}`);

    try {
      const { deletedBy } = event.metadata;

      // Business logic for user deletion:
      // 1. Archive user data
      await this.archiveUserData(event.aggregateId);

      // 2. Cancel active subscriptions
      await this.cancelUserSubscriptions(event.aggregateId);

      // 3. Remove user from external systems
      await this.removeFromExternalSystems(event.aggregateId);

      // 4. Create audit log
      await this.createAuditLog('USER_DELETED', event.aggregateId, {
        deletedBy,
        deletedAt: event.occurredAt
      });

      // 5. Send deletion confirmation if needed
      await this.sendDeletionNotification(event.aggregateId, deletedBy);

      this.logger.log(`Successfully processed UserDeleted event for user: ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to process UserDeleted event for user ${event.aggregateId}:`, error);
      throw error;
    }
  }

  /**
   * Generic user event handler for processing any user event
   */
  async handleUserEvent(event: IDomainEvent): Promise<void> {
    this.logger.debug(`Handling user event: ${event.type} for user: ${event.aggregateId}`);

    // Route to specific handlers based on event type
    switch (event.type) {
      case 'UserCreated':
        await this.handleUserCreated(event as UserCreatedEvent);
        break;
      case 'UserUpdated':
        await this.handleUserUpdated(event as UserUpdatedEvent);
        break;
      case 'UserDeleted':
        await this.handleUserDeleted(event as UserDeletedEvent);
        break;
      default:
        this.logger.warn(`Unknown user event type: ${event.type}`);
    }
  }

  // Private helper methods

  private async sendWelcomeEmail(email: string, _firstName: string, _lastName: string): Promise<void> {
    this.logger.debug(`Sending welcome email to: ${email}`);
    // TODO: Integrate with email service
    // await this.emailService.sendWelcomeEmail(email, firstName, lastName);
  }

  private async createUserProfile(
    userId: string,
    _email: string,
    _firstName: string,
    _lastName: string,
    _role: string
  ): Promise<void> {
    this.logger.debug(`Creating profile for user: ${userId}`);
    // TODO: Create user profile in CRM or other external systems
    // await this.crmService.createUserProfile(userId, email, firstName, lastName, role);
  }

  private async initializeUserPreferences(userId: string): Promise<void> {
    this.logger.debug(`Initializing preferences for user: ${userId}`);
    // TODO: Set up default user preferences
    // await this.userPreferencesService.initializeDefaults(userId);
  }

  private async logUserCreation(_event: UserCreatedEvent): Promise<void> {
    this.logger.debug(`Logging user creation for analytics: ${_event.aggregateId}`);
    // TODO: Send analytics data
    // await this.analyticsService.trackUserCreation(event);
  }

  private async createAuditLog(
    action: string,
    userId: string,
    _data: Record<string, any>
  ): Promise<void> {
    this.logger.debug(`Creating audit log for action: ${action} on user: ${userId}`);
    // TODO: Create audit log entry
    // await this.auditService.log(action, 'User', userId, data);
  }

  private async updateEmailInExternalSystems(userId: string, _newEmail: string): Promise<void> {
    this.logger.debug(`Updating email in external systems for user: ${userId}`);
    // TODO: Update email in CRM, newsletter, etc.
    // await this.crmService.updateEmail(userId, newEmail);
    // await this.newsletterService.updateEmail(userId, newEmail);
  }

  private async updateUserRoleInExternalSystems(userId: string, _newRole: string): Promise<void> {
    this.logger.debug(`Updating role in external systems for user: ${userId}`);
    // TODO: Update role in external systems
    // await this.rbacService.updateUserRole(userId, newRole);
  }

  private async notifyUserChanges(userId: string, _changes: Record<string, any>): Promise<void> {
    this.logger.debug(`Notifying systems about user changes: ${userId}`);
    // TODO: Notify relevant systems about user changes
    // await this.notificationService.notifyUserChanges(userId, changes);
  }

  private async archiveUserData(userId: string): Promise<void> {
    this.logger.debug(`Archiving user data: ${userId}`);
    // TODO: Archive user data for compliance
    // await this.archiveService.archiveUser(userId);
  }

  private async cancelUserSubscriptions(userId: string): Promise<void> {
    this.logger.debug(`Cancelling subscriptions for user: ${userId}`);
    // TODO: Cancel all active subscriptions
    // await this.subscriptionService.cancelAllForUser(userId);
  }

  private async removeFromExternalSystems(userId: string): Promise<void> {
    this.logger.debug(`Removing user from external systems: ${userId}`);
    // TODO: Remove from CRM, marketing lists, etc.
    // await this.crmService.deactivateUser(userId);
    // await this.marketingService.removeUser(userId);
  }

  private async sendDeletionNotification(userId: string, _deletedBy: string): Promise<void> {
    this.logger.debug(`Sending deletion notification for user: ${userId}`);
    // TODO: Send notification to compliance team or deletedBy user
    // await this.notificationService.notifyUserDeletion(userId, deletedBy);
  }
}